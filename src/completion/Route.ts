"use strict";

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { CompletionProvider, FeatureTagParam } from "..";
import AutocompleteResult from "../parser/AutocompleteResult";
import { projectPath } from "../support/project";

export class Route implements CompletionProvider {
    private routes: string[] = [];

    constructor() {
        this.scanRoutes();
        this.watchRoutes();
    }

    /**
     * Eklenti motoruna ne zaman uyanacağını söylüyoruz.
     * '@' tetikleyicisiyle boşlukta bile yazılsa uyanmasını sağlıyoruz.
     */
    tags() {
        const tags: FeatureTagParam[] = [
            {
                method: "@",
            },
        ];

        return tags;
    }

    /**
     * Eklenti motorunun "Acaba gerçekten tetikleyeyim mi?" kontrolü.
     * Boş satırlarda @ yazıldığında engellenmemesi için her zaman TRUE (yani result) dönüyoruz.
     */
    customCheck(
        result: AutocompleteResult,
        document: string,
    ): AutocompleteResult | false {
        return result;
    }

    /**
     * Ana otomatik tamamlama tetikleyicisi
     */
    provideCompletionItems(
        result: AutocompleteResult,
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): vscode.CompletionItem[] {
        const lineText = document.lineAt(position.line).text;

        // İmlecin solundaki metni al
        const leftSide = lineText.substring(0, position.character);

        // Satırda en son yazılan kelimenin başında @ var mı kontrol et (Örn: @home veya @frontend)
        const match = leftSide.match(/@([a-zA-Z0-9._-]*)$/);
        if (!match) {
            return [];
        }

        const typedText = match[1].toLowerCase(); // Kullanıcının o ana kadar yazdığı kelime (örn: "home")

        // Rotaları filtrele (Eğer kullanıcı bir şey yazdıysa sadece içinde geçenleri öner, boşsa hepsini öner)
        const filteredRoutes = typedText
            ? this.routes.filter((r) => r.toLowerCase().includes(typedText))
            : this.routes;

        return filteredRoutes.map((routeName) => {
            // Öneri listesinde görünecek etiket (Arama kolaylığı için başında @ ile listelenir)
            let completeItem = new vscode.CompletionItem(
                `@${routeName}`,
                vscode.CompletionItemKind.Snippet,
            );

            completeItem.detail = "Laravel Route Snippet";
            completeItem.documentation = new vscode.MarkdownString(
                `Inserts: \`{{ route('${routeName}') }}\``,
            );

            // Seçildiğinde editöre yazılacak şablon.
            // ${0} sayesinde işlem bittiğinde imleç en sona otomatik konumlanır.
            completeItem.insertText = new vscode.SnippetString(
                `{{ route('${routeName}') }}`,
            );

            // Tetikleyici olan '@' işaretini ve kullanıcının yazdığı kelimeyi (örn: @home)
            // tamamen silip yerine yeni şablonu temizce yerleştirmek için aralık (range) belirliyoruz.
            const startPosition = position.translate(0, -match[0].length);
            completeItem.range = new vscode.Range(startPosition, position);

            // Önerinin VS Code listesinde en üste çıkması için öncelik veriyoruz
            completeItem.sortText = "01";

            return completeItem;
        });
    }

    /**
     * routes/ klasöründeki tüm PHP dosyalarından rota isimlerini tarar
     */
    private scanRoutes() {
        const routesPath = projectPath("routes");
        if (!fs.existsSync(routesPath)) {
            return;
        }

        const files = this.getFilesRecursively(routesPath);
        const routeNames = new Set<string>();
        const routePattern = /->name\(\s*['"]([^'"]+)['"]\s*\)/g;

        for (const file of files) {
            try {
                const content = fs.readFileSync(file, "utf-8");
                let match;
                while ((match = routePattern.exec(content)) !== null) {
                    if (match[1]) {
                        routeNames.add(match[1]);
                    }
                }
            } catch (err) {
                //
            }
        }

        this.routes = Array.from(routeNames);
    }

    /**
     * Rota dosyalarında değişiklik olduğunda listeyi günceller
     */
    private watchRoutes() {
        const routesPath = projectPath("routes");
        if (!fs.existsSync(routesPath)) {
            return;
        }

        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(routesPath, "**/*.php"),
        );

        watcher.onDidChange(() => this.scanRoutes());
        watcher.onDidCreate(() => this.scanRoutes());
        watcher.onDidDelete(() => this.scanRoutes());
    }

    /**
     * Klasör altındaki dosyaları rekürsif olarak döner
     */
    private getFilesRecursively(dir: string): string[] {
        let results: string[] = [];
        const list = fs.readdirSync(dir);

        list.forEach((file) => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                results = results.concat(this.getFilesRecursively(filePath));
            } else if (file.endsWith(".php")) {
                results.push(filePath);
            }
        });

        return results;
    }
}
