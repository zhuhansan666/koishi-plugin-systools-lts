import { Context, Session, Time, h } from "koishi";
import {} from '@koishijs/plugin-http'

import { systoolsGlobal } from "../share";

export default async function update(ctx: Context, session: Session, errorCallback: (session: Session, msg: string | Error) => void) {
    session.send(`开始检查更新, 请稍后...`)

    const pluginFullName = systoolsGlobal.packageJson['name']
    const latestVersion = await ctx.updater.checkUpdate(ctx, pluginFullName)


    if (!latestVersion) {
        return `已是最新版本`
    }

    session.send(`检测到有可用更新 (${systoolsGlobal.packageJson['version']} => ${latestVersion}), 请在 30 秒内输入「Y」(不区分大小写) 以安装更新`)
    const input = (await session.prompt(30 * Time.second)).toLocaleLowerCase()
    if (input != 'y') {
        return `更新已取消安装`
    }

    session.send(`正在安装更新, 请不要关闭框架...`)

    const status = await ctx.updater.install(ctx, pluginFullName, latestVersion)
    if (status) {
        errorCallback(session, `安装失败, 具体内容详见日志`)
        return `安装失败, 具体内容详见日志`
    }

    systoolsGlobal.eventsList.push({
        name: 'reload',
        target: Date.now() + 3 * Time.second,  // 延时 3s 重载
        flags: ['clearAfterReload', 'keepEarliest'],
        catched: false
    })
    return `安装成功, koishi 将在 ${h('i18n:time', { value: 3 * Time.second })} 后重启`
}
