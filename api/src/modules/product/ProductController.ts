import { ProductService } from "@api/modules/product/ProductService.js";
import { Request, Response } from "express";
import { getAuthUser } from "@api/middlewares/authMiddleware.js";
import { ValidationError } from "@api/errors/AppError.js";
import { apiParseRequestsTotal } from "@api/observability/metrics.js";

export class ProductController {
  private productService: ProductService;
  constructor() {
    this.productService = new ProductService();
  }

  getCollection = async (req: Request, res: Response) => {
    const userId: number = getAuthUser(res).userId;
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 8, 1), 50);
    const offset = (page - 1) * limit;

    const { products, totalCount } = await this.productService.getCollection(
      userId,
      limit,
      offset,
    );

    res.status(200).json({ collection: products, totalCount });
  };

  getProductStoreRecords = async (req: Request, res: Response) => {
    const productId: number = parseInt(req.params.productId, 10);

    if (isNaN(productId)) {
        throw new ValidationError("Invalid product ID");
    }

    const storeRecords =
      await this.productService.getProductStoreRecords(productId);
    res
      .status(200)
      .json({
        message: `Got product details for product ${productId}`,
        storeRecords,
      });
  };

  deleteProductFromCollection = async (req: Request, res: Response) => {
    const productId: number = parseInt(req.params.productId, 10);

    if (isNaN(productId)) {
      throw new ValidationError("Invalid product ID");
    }

    const userId: number = getAuthUser(res).userId;

    await this.productService.deleteProductFromCollection(userId, productId);
    res.status(204).json({ message: "Product deleted successfully" });
  };

  parse = async (req: Request, res: Response) => {
      const productLink: string = req.body.url;

      if (!productLink || typeof productLink !== 'string') {
        throw new ValidationError("Product URL is required");
      }

      const result = await this.productService.parse(productLink);

      const productId = result.productId;
      const parsedResults = result.parseResult;
      apiParseRequestsTotal.inc({ store: parsedResults.primaryStore });

      return res.status(200).json({ productId, parsedResults });
  };

  addProduct = async (req: Request, res: Response) => {
      const userId: number = getAuthUser(res).userId;
      const productId: number = req.body.productId;
      
      await this.productService.addProductToUsersCollection(userId, productId);

      res.status(201).json({ message: "Product created successfully" });
  };
}
