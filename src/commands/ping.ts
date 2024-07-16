import { Session, Context, h } from "koishi"
import {} from '@koishijs/plugin-http'

import { ipAPI, ipAPIArgs } from "../configs/configs"
import { ipAPIResult } from "../types/types"
import { Config } from ".."

export default async function ping(ctx: Context, session: Session, ip: string) {
    const config: Config = ctx.config
    if (ip) {
        let newip = ip.replace(new RegExp('h?t?t?p?s?:?//', 'g'), '')
        if (newip.includes(':')) {
            newip = newip.split(':')[0]
        }

        if (newip.includes('/') || newip.includes('\\')) {
            newip = newip.split('/')[0]
            newip = newip.split('\\')[0]
        }

        if (newip != ip) {
            ip = newip
            session.send(`注意: IP 已自动格式化为 ${ip}`)
        }
    }

    try {
        const data: ipAPIResult = await ctx.http.get(`${ipAPI}${ip ?? ''}?${ipAPIArgs}`, { timeout: config.axiosConfig ? config.axiosTimeout : null, validateStatus: () => { return true } })
        if (!data || typeof data === 'string') {
            return `请求失败, 返回值不符合 JSON 标准\n${data}`
        } else if (data.status == 'fail') {
            return `请求失败, 请检查 IP 是否正确\n错误信息: ${data.message}`
        }

        return `请求返回
IP: ${data.query}
IP 属地: ${data.continent} ${data.country} ${data.regionName} ${data.city} ${data.district}\
${data.isp ? `\n运营商: ${data.isp}` : ''}\
${data.org ? `\n组织名称: ${data.org}` : ''}\
${data.as ? `\n公司归属: ${data.as}` : ''}\
${data.reverse ? `\nDNS 查询信息: ${data.reverse}` : ''}\
${data.mobile ? '\n该 IP 使用移动数据连接' : ''}\
${data.proxy ? '\n该 IP 是代理服务器/虚拟专用网络服务器/洋葱路由出口地址' : ''}\
${data.hosting ? '\n该 IP 是数据中心/网络托管商' : ''}`

    } catch (error) {
        return `请求失败\n${error.stack}`
    }
}
