import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toProfile } from "./user.mapper";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found.");
    return toProfile(user);
  }

  async search(query: string, currentUserId?: string) {
    const term = query.trim();
    if (term.length < 2) return [];
    const users = await this.prisma.user.findMany({
      where: {
        id: currentUserId ? { not: currentUserId } : undefined,
        OR: [
          { username: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } }
        ]
      },
      take: 8,
      orderBy: { username: "asc" }
    });
    return users.map(toProfile);
  }
}
