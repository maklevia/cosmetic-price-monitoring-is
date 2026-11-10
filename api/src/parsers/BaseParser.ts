import { ParsedProduct } from "@api/types/ProductTypes.js";
import { StoreName } from "@api/types/Enums.js";
import { checkProductNamesSimilarity } from "@api/parsers/utils/stringUtils.js";
import { BadGatewayError } from "@api/errors/AppError.js";
import {
  parserStoreRequestDurationSeconds,
  parserStoreRequestsTotal,
} from "@api/observability/metrics.js";
import axios from "axios";

export abstract class BaseParser {
  abstract readonly storeName: StoreName;

  protected abstract fetchByLink(link: string): Promise<ParsedProduct | null>;
  protected abstract fetchByNameAndBrand(
    searchProductName: string,
    searchProductBrand: string,
  ): Promise<ParsedProduct | null>;

  async parseByLink(link: string): Promise<ParsedProduct | null> {
    const stopTimer = parserStoreRequestDurationSeconds.startTimer({
      store: this.storeName,
    });

    try {
      const product = await this.fetchByLink(link);
      parserStoreRequestsTotal.inc({
        store: this.storeName,
        result: product ? "success" : "not_found",
      });
      return product;
    } catch (error) {
      parserStoreRequestsTotal.inc({
        store: this.storeName,
        result: "error",
      });
      this.handleParseError(error);
    } finally {
      stopTimer();
    }
  }

  async parseByNameAndBrand(
    searchProductName: string,
    searchProductBrand: string,
  ): Promise<ParsedProduct | null> {
    const stopTimer = parserStoreRequestDurationSeconds.startTimer({
      store: this.storeName,
    });

    try {
      const product = await this.fetchByNameAndBrand(
        searchProductName,
        searchProductBrand,
      );
      parserStoreRequestsTotal.inc({
        store: this.storeName,
        result: product ? "success" : "not_found",
      });
      return product;
    } catch (error) {
      parserStoreRequestsTotal.inc({
        store: this.storeName,
        result: "error",
      });
      this.handleParseError(error);
    } finally {
      stopTimer();
    }
  }

  protected extractIdFromUrl(link: string, pattern: RegExp): string | null {
    const match = link.match(pattern);
    return match?.[1] ?? null;
  }

  protected validateMatch(
    searchName: string,
    searchBrand: string,
    resultName: string,
    resultBrand: string,
  ): boolean {
    return checkProductNamesSimilarity(
      searchName,
      resultName,
      searchBrand,
      resultBrand,
    );
  }

  private handleParseError(error: unknown): never {
    const isAxiosNetworkError = axios.isAxiosError(error);
    let isGotScrapingError = false;
    
    if (error instanceof Error) {
      isGotScrapingError =
        error.name === "HTTPError" ||
        error.name === "RequestError" ||
        error.name === "TimeoutError";
    }
    
    if (isAxiosNetworkError || isGotScrapingError) {
      throw new BadGatewayError(`Store ${this.storeName} is temporarily unavailable`);
    }

    throw error;
  }
}
