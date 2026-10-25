import { AppDataSource } from "@api/config/data-source.js";
import { User } from "@api/modules/user/User.js";
import { ConflictError } from "@api/errors/AppError.js";

export interface CreateUserProfileResult {
  user: User;
  created: boolean;
}

export class UserRepository {
  private userRepo = AppDataSource.getRepository(User);

  async createOrGetProfile(
    id: number,
    email: string,
    name: string | null,
  ): Promise<CreateUserProfileResult> {
    const existingById = await this.userRepo.findOneBy({ id });

    if (existingById) {
      if (existingById.email !== email) {
        throw new ConflictError("User ID is already used by another profile");
      }

      return { user: existingById, created: false };
    }

    const existingByEmail = await this.userRepo.findOneBy({ email });
    if (existingByEmail) {
      throw new ConflictError("Email is already used by another profile");
    }

    const user = new User();
    user.id = id;
    user.email = email;
    user.name = name;

    await this.userRepo.insert(user);

    return { user, created: true };
  }

  async findUserById(userId: number): Promise<User | null> {
    const foundUser = await this.userRepo.findOneBy({ id: userId });
    return foundUser;
  }

  async isTelegramAccountBinded(telegramAccountId: number): Promise<boolean> {
    const isBinded = await this.userRepo.existsBy({
      telegramAccountId: telegramAccountId,
    });
    return isBinded;
  }

  async updateUser(userId: number, updateData: Partial<User>): Promise<void> {
    await this.userRepo.update(userId, updateData);
  }
}
