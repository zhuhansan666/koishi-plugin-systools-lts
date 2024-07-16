import { Context } from "koishi"

import { Config } from ".."

export function post(ctx: Context, url: string, data?: object, options?: object) {
    const config: Config = ctx.config
    return ctx.http.post(
        url,
        data,
        {
            timeout: config.axiosConfig ? config.axiosTimeout : null,
            validateStatus: () => { return true },
            ...options
        }
    )
}

export function get(ctx: Context, url: string, data?: object, options?: object) {
    const config: Config = ctx.config
    return ctx.http.get(
        url,
        {
            params: data,
            timeout: config.axiosConfig ? config.axiosTimeout : null,
            validateStatus: () => { return true },
            ...options
        }
    )
}