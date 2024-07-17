import { Context } from "koishi";
import { } from '@koishijs/plugin-market'

import { logger } from "../share";

export async function reload(ctx: Context) {
    try {
        await (ctx.console.listeners['manager/app-reload'] as any).callback(ctx.loader.config)
    } catch(error) {
        logger.warn(`重载错误`)
        logger.error(error)
    }
}
