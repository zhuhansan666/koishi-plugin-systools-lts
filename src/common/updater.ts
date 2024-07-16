import { Context, Dict } from "koishi";
import { } from '@koishijs/plugin-market'
import { gt } from "semver"

import { get } from "./network";
import { functionStatusPromise } from "../types/types";
import { logger } from "../share";

export async function getLatestVersion(ctx: Context, pluginFullName: string): functionStatusPromise {
    /**
     * @param pluginFullName like `koishi-plugin-systools`
     */
    const APIBase = new URL('https://registry.npmjs.org/')

    try {
        const data = await get(ctx, `https://${APIBase.host}/${pluginFullName}/latest`)

        if (!data || !data.version) {
            return {
                status: 1,
                data: data,
                msg: data
            }
        }

        return {
            status: 0,
            data: data.version,
            msg: 'success'
        }
    } catch(error) {
        return {
            status: -1,
            msg: error
        }
    }
}

export function checkVersion(latest: string, current: string): boolean {
    /**
     * 返回 false 代表已是最新版本
     * 
     * 即返回值 true 代表 有新的可用更新
     */
    if (!latest || !current) {
        return false
    }

    return gt(latest, current)
}

export async function install(ctx: Context, deps: Dict<string>): functionStatusPromise {
    /**
     * @param deps { pluginName: targetVerison }
     */
    const installer = ctx.installer
    // await installer.override(deps)
    
    try {
        const status = await installer.install(deps)

        return {
            status: status,
            msg: status ? new Error('failed') : 'success'
        }
    } catch(error) {
        return {
            status: -1,
            msg: error
        }
    }
}

export async function reload(ctx: Context) {
    try {
        await (ctx.console.listeners['manager/app-reload'] as any).callback(ctx.loader.config)
    } catch(error) {
        logger.warn(`重载错误`)
        logger.error(error)
    }
}
