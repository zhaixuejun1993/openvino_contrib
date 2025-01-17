import { InlineCompletionItem, Position, Range, TextDocument, window } from 'vscode';
import { EXTENSION_DISPLAY_NAME } from '../constants';
import { IGenerateRequest, backendService } from '../services/backend.service';
import { extensionState } from '../state';

const outputChannel = window.createOutputChannel(EXTENSION_DISPLAY_NAME, { log: true });
const logCompletionInput = (input: string): void => outputChannel.append(`Completion input:\n${input}\n\n`);
const logCompletionOutput = (output: string): void => outputChannel.append(`Completion output:\n${output}\n\n`);

class CompletionService {
  private readonly _contextCharactersLength = 4_000;

  private _getTextBeforeCursor(document: TextDocument, position: Position): string {
    const offset = document.offsetAt(position);
    const startOffset = Math.max(0, offset - this._contextCharactersLength);
    const startPosition = document.positionAt(startOffset);
    return document.getText(new Range(startPosition, position));
  }

  private _getTextAfterCursor(document: TextDocument, position: Position): string {
    const offset = document.offsetAt(position);
    const endOffset = offset + this._contextCharactersLength;
    const endPosition = document.positionAt(endOffset);
    return document.getText(new Range(position, endPosition));
  }

  private _prepareCompletionInput(textBeforeCursor: string, textAfterCursor: string): string {
    const { fillInTheMiddleMode, startToken, middleToken, endToken } = extensionState.config;

    // Use FIM (fill-in-the-middle) mode if it is enabled in settings and if `textAfterCursor` is not empty
    if (fillInTheMiddleMode && textAfterCursor.trim()) {
      return `${startToken}${textBeforeCursor}${middleToken}${textAfterCursor}${endToken}`;
    }
    return textBeforeCursor;
  }

  async getCompletion(document: TextDocument, position: Position): Promise<InlineCompletionItem[]> {
    const textBeforeCursor = this._getTextBeforeCursor(document, position);
    const textAfterCursor = this._getTextAfterCursor(document, position);
    const completionInput = this._prepareCompletionInput(textBeforeCursor, textAfterCursor);
    logCompletionInput(completionInput);

    const {
      temperature,
      stopToken,
      middleToken,
      topK,
      topP,
      minNewTokens,
      maxNewTokens,
      serverRequestTimeout,
      repetitionPenalty,
    } = extensionState.config;

    const response = await backendService.generateCompletion({
      inputs: completionInput,
      parameters: {
        temperature,
        top_k: topK,
        top_p: topP,
        min_new_tokens: minNewTokens,
        max_new_tokens: maxNewTokens,
        timeout: serverRequestTimeout,
        repetition_penalty: repetitionPenalty,
      },
    });

    if (!response) {
      return [];
    }

    let generatedText = response.generated_text;
    if (generatedText.startsWith(completionInput)) {
      generatedText = generatedText.slice(completionInput.length);
    }
    logCompletionOutput(generatedText);
    generatedText = generatedText.replace(stopToken, '').replace(middleToken, '');

    const completionItem = new InlineCompletionItem(generatedText, new Range(position, position.translate(0, 1)));
    return [completionItem];
  }

  async getCompletionStream(
    document: TextDocument,
    position: Position,
    onDataChunk: (chunk: string) => unknown,
    signal?: AbortSignal
  ) {
    const textBeforeCursor = this._getTextBeforeCursor(document, position);
    const textAfterCursor = this._getTextAfterCursor(document, position);
    const completionInput = this._prepareCompletionInput(textBeforeCursor, textAfterCursor);
    logCompletionInput(completionInput);

    const { temperature, topK, topP, minNewTokens, maxNewTokens, serverRequestTimeout, repetitionPenalty } =
      extensionState.config;

    const request: IGenerateRequest = {
      inputs: completionInput,
      parameters: {
        temperature,
        top_k: topK,
        top_p: topP,
        min_new_tokens: minNewTokens,
        max_new_tokens: maxNewTokens,
        timeout: serverRequestTimeout,
        repetition_penalty: repetitionPenalty,
      },
    };

    outputChannel.append(`Completion output:\n`);
    return backendService.generateCompletionStream(
      request,
      (chunk) => {
        outputChannel.append(chunk);
        onDataChunk(chunk);
      },
      signal
    );
  }
}

export default new CompletionService();
