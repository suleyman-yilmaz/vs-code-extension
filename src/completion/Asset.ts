"use strict";

import * as vscode from "vscode";
import { CompletionProvider, FeatureTagParam } from "..";
import AutocompleteResult from "../parser/AutocompleteResult";
import { getAssets } from "../repositories/asset"; // Hazır asset listesini çekiyoruz

export class Asset implements vscode.CompletionItemProvider {

    /**
     * Eklenti motoruna '@' karakteri yazıldığında uyanmasını söylüyoruz.
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
     * Boş satırlarda veya rastgele yerlerde @ yazıldığında engellenmemesi için TRUE dönüyoruz.
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
        document: vscode.TextDocument, // İlk parametre artık doğrudan VS Code'un belgesi
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): vscode.CompletionItem[] {
        // İlk parametre olan 'result' tamamen kalktı!

        const lineText = document.lineAt(position.line).text;

        // İmlecin solundaki metni al
        const leftSide = lineText.substring(0, position.character);

        // Satırda en son yazılan kelimenin başında @ var mı kontrol et
        const match = leftSide.match(/@([a-zA-Z0-9._\-\/]*)$/i);
        if (!match) {
            return [];
        }

        const typedText = match[1].toLowerCase();

        // Eklentinin hafızasındaki hazır asset öğelerini alıyoruz
        const assetItems = getAssets().items || [];

        // Asset'leri filtrele
        const filteredAssets = typedText
            ? assetItems.filter((asset) => asset.path.toLowerCase().includes(typedText))
            : assetItems;

        return filteredAssets.map((asset) => {
            let completeItem = new vscode.CompletionItem(
                `@${asset.path}`,
                vscode.CompletionItemKind.Snippet,
            );

            completeItem.detail = "Laravel Asset Snippet";
            completeItem.documentation = new vscode.MarkdownString(
                `Inserts: \`{{ asset('${asset.path}') }}\``,
            );

            completeItem.insertText = new vscode.SnippetString(
                `{{ asset('${asset.path}') }}`,
            );

            // VS Code arama motorunun @ işaretini yutmaması için filtre metni tanımlıyoruz
            completeItem.filterText = `@${asset.path}`;

            // Yazılan @... kısmını tamamen silip yerine snippet'ı yerleştirecek range ayarı
            const startPosition = position.translate(0, -match[0].length);
            completeItem.range = new vscode.Range(startPosition, position);

            completeItem.sortText = "01";

            return completeItem;
        });
    }
}