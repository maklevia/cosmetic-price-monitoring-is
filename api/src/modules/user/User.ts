import { Collection } from "@api/modules/product/Collection.js";
import { StoreRecordOverride } from "@api/modules/product/StoreRecordOverride.js";
import { UserNotification } from "@api/modules/notification/UserNotification.js";
import { ChannelToken } from "@api/modules/channel/ChannelToken.js";
import { Column, CreateDateColumn, UpdateDateColumn, Entity, OneToMany, PrimaryColumn } from "typeorm";

@Entity("Users")
    export class User {
        @PrimaryColumn({type: "int"})
        id: number;

        @Column({type: "varchar", length: 255, unique: true})
        email: string;

        @Column({type: "varchar", length: 25, nullable: true})
        name: string | null;

        @Column({name: "telegram_account_id", type: "int", nullable: true, unique: true})
        telegramAccountId: number | null;

        @CreateDateColumn({name: "created_at", type: "timestamptz", default: () => "CURRENT_TIMESTAMP"})
        createdAt: Date;

        @UpdateDateColumn({name: "updated_at", type: "timestamptz", default: () => "CURRENT_TIMESTAMP"})
        updatedAt: Date;

        @OneToMany(() => Collection, (collection) => collection.user)
        collections: Collection[];

        @OneToMany(() => StoreRecordOverride, (override) => override.user)
        storeRecordOverrides: StoreRecordOverride[];

        @OneToMany(() => UserNotification, (notification) => notification.user)
        notifications: UserNotification[];

        @OneToMany(() => ChannelToken, (token) => token.user)
        channelTokens: ChannelToken[];
    }