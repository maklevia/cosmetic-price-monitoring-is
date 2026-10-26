import { getEnvOrThrow } from "@bot/utils/getEnvOrThrow.js";
import axios from "axios";
import { Context } from "telegraf";

const API_URL = getEnvOrThrow("API_INTERNAL_URL");
const API_KEY = getEnvOrThrow("API_KEY");

export const onShowPriceDrops = async (ctx: Context) => {
  if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

  const data = ctx.callbackQuery.data;
  const parts = data.split(":");
  if (parts.length !== 3 || parts[0] !== "pd") return;

  const batchId = parts[1];
  const page = parseInt(parts[2], 10);

  try {
    const response = await axios.get(
      `${API_URL}/channel/drops/batch/${batchId}`,
      { headers: { "x-api-key": API_KEY } },
    );

    const products = response.data.drops;

    if (!products || products.length === 0) {
      await ctx.answerCbQuery("These price drops have expired.");
      return;
    }

    const currentIndex = Math.min(page, products.length - 1);
    const p = products[currentIndex];
    const total = products.length;

    const caption =
      `🚨 <b>Price Drop Alert!</b>\n\n` +
      `💄 <b>${p.name}</b>\n` +
      `📉 Price: <s>${p.oldPrice} UAH</s> ➡️ <b>${p.newPrice} UAH on ${p.storeName}</b>\n\n` +
      `<i><a href="${p.link}">Tap here to view the product</a></i>`;

    // Build navigation buttons
    const navButtons: { text: string; callback_data: string }[] = [];
    if (currentIndex > 0) {
      navButtons.push({ text: "⬅️ Prev", callback_data: `pd:${batchId}:${currentIndex - 1}` });
    }
    navButtons.push({ text: `${currentIndex + 1}/${total}`, callback_data: "noop" });
    if (currentIndex < total - 1) {
      navButtons.push({ text: "Next ➡️", callback_data: `pd:${batchId}:${currentIndex + 1}` });
    }

    const replyMarkup = { inline_keyboard: [navButtons] };

    const msg = ctx.callbackQuery.message as any;
    const isCurrentlyMedia = !!(msg && (msg.photo || msg.video || msg.document || msg.animation));
    const wantsMedia = !!p.image;

    // Telegram cannot edit a text message into a media message, or vice versa.
    // If the message type needs to change, we MUST delete the old message and send a new one.
    const needsToChangeType = wantsMedia !== isCurrentlyMedia;

    if (needsToChangeType) {
      try {
        await ctx.deleteMessage();
      } catch {
        // Message might be too old to delete, that's okay
      }

      if (wantsMedia) {
        await ctx.replyWithPhoto(p.image, {
          caption,
          parse_mode: "HTML",
          reply_markup: replyMarkup,
        });
      } else {
        await ctx.reply(caption, {
          parse_mode: "HTML",
          reply_markup: replyMarkup,
          link_preview_options: { is_disabled: true },
        });
      }
    } else {
      // The media type matches, so we can edit it seamlessly in place (carousel!)
      if (wantsMedia) {
        await ctx.editMessageMedia(
          { type: "photo", media: p.image, caption, parse_mode: "HTML" },
          { reply_markup: replyMarkup },
        );
      } else {
        await ctx.editMessageText(caption, {
          parse_mode: "HTML",
          reply_markup: replyMarkup,
          link_preview_options: { is_disabled: true },
        });
      }
    }

    await ctx.answerCbQuery();
  } catch (error) {
    console.error("Failed to fetch price drops:", error);
    await ctx.answerCbQuery("Failed to fetch products. Please try again later.");
  }
};
