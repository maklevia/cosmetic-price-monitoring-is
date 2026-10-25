import { UserRepository, CreateUserProfileResult } from "@api/modules/user/UserRepository.js";
import { User } from "@api/modules/user/User.js";
import { NotFoundError } from "@api/errors/AppError.js";

const userRepository = new UserRepository();

export class UserService {
  async createUserProfile(
    id: number,
    email: string,
    name: string | null,
  ): Promise<CreateUserProfileResult> {
    return userRepository.createOrGetProfile(id, email, name);
  }

  async getUserInfo(userId: number): Promise<User> {
    const user = await userRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundError("No user data found");
    }

    return user;
  }

  async isTelegramAccountBinded(telegramAccountId: number): Promise<boolean> {
    return await userRepository.isTelegramAccountBinded(telegramAccountId);
  }

  async updateUser(userId: number, updateData: Partial<User>): Promise<void> {
    return await userRepository.updateUser(userId, updateData);
  }
}
