import { Context, Schema, Session, Time, remove } from 'koishi'
import path from 'path'

import { machineId } from './configs/configs'
import { Object2String } from "./debug/functions"

export const name = 'systools-lts'

export const usage = `
## 设备唯一识别码
* ${machineId}
`

export interface Config {
    axiosConfig: boolean,
    axiosTimeout: number,

    enableExec: boolean,

    enableBackup: boolean,
    backupFiles: Array<string>,
    backupInterval: number,
    keepBackupFiles: number

    enableGithubBackup: boolean,
    githubUsername: string,
    githubToken: string,
    repoName: string,
    githubBackupFiles: Array<string>,
    githubBackupInterval: number,
    keepGithubBackupFiles: number,

    checkUpdateInterval: number,
    maxTry: number,
    failedColdTime: number
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        axiosConfig: Schema.boolean()
            .default(false)
            .description('启用自定义请求配置 <br>> 不启用将使用全局请求配置'),
    }).description('请求配置'),
    Schema.union([
        Schema.object({
            axiosConfig: Schema.const(true).required(),
            axiosTimeout: Schema.number()
                .default(300000)
                .description('请求超时 毫秒')
        }),
        Schema.object({})
    ]),

    Schema.object({
        enableExec: Schema.boolean()
            .default(false)
            .description('`taskrun` 指令使用 `Exec` 运行进程 <br> 启用该选项后不支持流输出, 仅等待进程运行结束后输出内容<br>? 该选项可能导致 `tasklist` `taskinput` 指令无效'),
    }).description('进程配置'),

    Schema.object({
        enableBackup: Schema.boolean()
            .default(false)
            .description('启用备份'),
    }).description('本地备份配置'),
    Schema.union([
        Schema.object({
            enableBackup: Schema.const(true).required(),
            '': Schema.never()
                .description(
                    `本地备份规则: data/systools/backup/<文件名>/<文件名>.<备份时间的13位时间戳>.bak`
                ),
            backupFiles: Schema.array(String)
                .role('table')
                .default([])
                .description('需要备份的文件, 暂**不支持**正则表达式'),
            backupInterval: Schema.number()
                .min(0)
                .default(Time.minute)
                .description('备份间隔 毫秒'),
            keepBackupFiles: Schema.number()
                .min(1)
                .default(60)
                .description('保留备份文件数量最大值 个 (包含上限) <br> 备份位置位于 `/data/systools/backup/koishi.yml/`'),

        }),
        Schema.object({})
    ]),

    Schema.object({
        enableGithubBackup: Schema.boolean()
            .default(false)
            .description('启用 GitHub 云备份'),
    }).description('云备份配置'),
    Schema.union([
        Schema.object({
            enableGithubBackup: Schema.const(true).required(),
            '': Schema.never()
                .description(
                    `GitHub 备份规则: 在所创建的仓库的 master 分支的 <[设备唯一识别码](#设备唯一识别码)>/<文件名>/<文件名>.<备份时间的13位时间戳>.bak`
                ),
            githubUsername: Schema.string()
                .required(true)
                .description('GitHub 用户名'),
            githubToken: Schema.string()
                .required(true)
                .description('GitHub token 用于创建仓库和上传备份文件 <br>注意: 请使用 classic token, 否则可能发生未知错误'),
            repoName: Schema.string()
                .default('koishi.backup')
                .description('GitHub 云备份的仓库名称 <br>注意: 由于 `koishi.yml` 可能存在账户等敏感信息, 备份仓库已默认设置为私有, 切勿将敏感信息公开, 否则所造成一切后果于本插件 / koishi 框架 / 开源普通 等均无关'),
            githubBackupFiles: Schema.array(String)
                .role('table')
                .default([])
                .description('需要备份至 GitHub 的文件, 暂**不支持**正则表达式'),
            githubBackupInterval: Schema.number()
                .min(0)
                .default(Time.hour)
                .description('Github 备份间隔 毫秒'),
            keepGithubBackupFiles: Schema.number()
                .min(1)
                .default(24)
                .description('在 Github 保留备份文件数量最大值 个 (包含上限)'),
        }),
        Schema.object({})
    ]),

    Schema.object({
        checkUpdateInterval: Schema.number()
            .min(-1)
            .default(Time.hour)
            .description('检查更新间隔 毫秒'),
        maxTry: Schema.number()
            .min(0)
            .default(10)
            .description('最大连续尝试次数'),
        failedColdTime: Schema.number()
            .min(10)
            .default(10 * 60)
            .description('更新连续失败冷却时间 秒')
    }).description('更新配置')
        .hidden(process.env.NODE_ENV !== 'development')  // 生产环境不让用户瞎改我的更新配置

]) as Schema<Config>  // 奇奇怪怪的 bug 给他修掉

import { backup } from './common/backup'
import { logger, systoolsGlobal } from './share'

import ping from './commands/ping'
import exec from './commands/exec'
import { kill, input, list } from './commands/exec'
import sysinfo from './commands/sysinfo'
import update from './commands/update'

import { readFile, writeFile } from './common/fs'
import { githubBackup } from './common/githubBackup'

import { getLatestVersion, checkVersion, install, reload } from './common/updater'
import loop from './events/loop'
import { functions as eventFunctions } from './events/loop'


export async function apply(ctx: Context, config: Config) {
    const systoolsGlobalCacheFile = path.resolve(ctx.baseDir, 'cache/systools/systoolGlobal.json')
    systoolsGlobal.systoolsGlobalCacheFile = systoolsGlobalCacheFile

    const { status, data, msg } = await readFile(systoolsGlobalCacheFile)
    if (!status) {  // 读写成功
        for (const key in data) {  // 覆写
            systoolsGlobal[key] = data[key]
        }
    } else {
        logger.debug(`read cache/systools/systoolGlobal.json error: ${msg}`)
    }

    for (let i = 0; i < systoolsGlobal.eventsList.length; i++) {
        const event = systoolsGlobal.eventsList[i]
        if (event && event.flags.includes('clearAfterReload')) {
            event.catched = true
        }

        if (event && event.catched) {
            systoolsGlobal.eventsList.splice(i, 1)
        }
    }

    const { status: packageJsonStatus, data: packageJsonData, msg: packageJsonMsg } = await readFile(path.resolve(__dirname, '../package.json'))
    let packageJson = {}
    if (!packageJsonStatus) {
        packageJson = packageJsonData ?? {}
    } else {
        logger.warn(`读取 package.json 错误: ${packageJsonMsg}`)
    }
    systoolsGlobal.packageJson = packageJson
    systoolsGlobal.updateStatus.latest = systoolsGlobal.packageJson['version'] ?? '0.0.0'

    systoolsGlobal.eventsLoopIntervalId = parseInt(setInterval(async () => {
        await loop(systoolsGlobal.eventsList)
    }) as any, 50)

    eventFunctions.reload = async () => {
        await reload(ctx)
    }

    if (config.enableBackup) {  // 初始化 本地备份
        if (config.backupFiles.length <= 0) {
            logger.warn(`备份列表为空, 退出备份`)
            return
        }

        let backupFunc = async () => {
            for (let i = 0; i < config.backupFiles.length; i++) {
                const file = config.backupFiles[i]
                try {
                    await backup(path.resolve(ctx.baseDir, file), path.resolve(ctx.baseDir, `data/systools/backup/${path.parse(file).base}/`), config.keepBackupFiles)
                } catch (error) {
                    logger.debug(`backup ${file} error: ${error}`)
                }
            }

            systoolsGlobal.eventsList.push(
                {
                    name: 'backup',
                    target: Date.now() + config.backupInterval,
                    flags: ['clearAfterReload'],
                    catched: false
                }
            )
        }

        eventFunctions.backup = backupFunc

        systoolsGlobal.eventsList.push(
            {
                name: 'backup',
                target: Date.now(),
                flags: ['clearAfterReload'],
                catched: false
            }
        )
    }

    if (config.enableGithubBackup) {  // 初始化 GitHub 云备份
        if (!config.githubUsername || !config.githubToken) {
            logger.warn(`GitHub 备份配置缺少必填项, 退出备份`)
            return
        }

        if (config.githubBackupFiles.length <= 0) {
            logger.warn(`GitHub 备份列表为空, 退出备份`)
            return
        }

        let githubBackupFunc = async () => {
            for (let i = 0; i < config.githubBackupFiles.length; i++) {
                const file = config.githubBackupFiles[i]
                try {
                    await githubBackup(ctx, path.resolve(ctx.baseDir, file), `${machineId}/${path.parse(file).base}`)  // githubPath like "94cfe6ee-a66f-4f77-a949-2241c125f33f/koishi.yml"
                } catch (error) {
                    logger.debug(`GitHub backup ${file} error: ${error}`)
                }
            }

            systoolsGlobal.eventsList.push({
                name: 'githubBackup',
                target: Date.now() + config.githubBackupInterval,
                flags: ['clearAfterReload'],
                catched: false
            })
        }

        eventFunctions.githubBackup = githubBackupFunc

        systoolsGlobal.eventsList.push({
            name: 'githubBackup',
            target: Date.now(),
            flags: ['clearAfterReload'],
            catched: false
        })
    }

    if (config.checkUpdateInterval > 0) {
        const checkUpdateFunc = async () => {
            logger.debug(`开始检查更新`)

            systoolsGlobal.eventsList.push({  // 下一次检查更新的 event
                name: 'checkUpdate',
                target: Date.now() + config.checkUpdateInterval,
                flags: ['clearAfterReload'],
                catched: false
            })

            const updateStatus = systoolsGlobal.updateStatus
            updateStatus.tiped = true

            const { status, data: latestVersion, msg } = await getLatestVersion(ctx, packageJson['name'])
            if (status) {
                logger.warn(`检查更新错误: ${msg}, 退出更新操作`)
                updateStatus.code = -1
                updateStatus.msg = 'updateError'
                updateStatus.desc = `检查更新错误: ${msg}`
                updateStatus.timestamp = Date.now()
                updateStatus.totalTried += 1
                writeFile(systoolsGlobalCacheFile, systoolsGlobal)
                return
            }

            if (!checkVersion(latestVersion, updateStatus.latest)) {
                logger.debug(`已经是最新版本 (${latestVersion}) 或更高版本, 退出更新操作`)
                updateStatus.tiped = false
                updateStatus.code = 0
                updateStatus.msg = 'isLatest'
                updateStatus.desc = `已经是最新版本 (${latestVersion}) 或更高版本`
                updateStatus.timestamp = Date.now()
                updateStatus.totalTried = 0
                updateStatus.latest = latestVersion
                writeFile(systoolsGlobalCacheFile, systoolsGlobal)
                return
            }

            if (config.maxTry > 0 && updateStatus.totalTried > config.maxTry) {
                if (updateStatus.timestamp && Date.now() - updateStatus.timestamp <= config.failedColdTime * Time.second) {
                    logger.debug(`超过最大连续更新尝试上限, 退出更新操作`)
                    updateStatus.tiped = false
                    writeFile(systoolsGlobalCacheFile, systoolsGlobal)
                    return
                } else {
                    updateStatus.totalTried = 0
                }
            }

            // 提醒过了就当作更新了 (x
            logger.info(`有新版本啦! (${updateStatus.latest} => ${latestVersion})`)
            updateStatus.tiped = true
            updateStatus.code = 0
            updateStatus.msg = 'updatedSuccessfully'
            updateStatus.desc = `有新版本啦! (${updateStatus.latest} => ${latestVersion})`
            updateStatus.timestamp = Date.now()
            updateStatus.totalTried = 0
            updateStatus.latest = latestVersion

            writeFile(systoolsGlobalCacheFile, systoolsGlobal)
        }

        eventFunctions.checkUpdate = checkUpdateFunc
        systoolsGlobal.eventsList.push({
            name: 'checkUpdate',
            target: Date.now(),  // 立即检查更新
            flags: ['clearAfterReload'],
            catched: false
        })
    }

    writeFile(systoolsGlobalCacheFile, systoolsGlobal)  // 更新 backupIntervalId 和/或 githubBackupIntervalId

    // ctx.on('command/before-execute', () => {
    //     const obj = systoolsGlobal.useFrequencys[new Date().getHours()]
    //     obj.commands += 1
    //     obj.result = getUseFrequency(obj.commands, obj.receivedMessages, obj.sendMessages)

    //     writeFile(systoolsGlobalCacheFile, systoolsGlobal)
    // })

    // ctx.on('message', () => {
    //     const obj = systoolsGlobal.useFrequencys[new Date().getHours()]
    //     obj.receivedMessages += 1
    //     obj.result = getUseFrequency(obj.commands, obj.receivedMessages, obj.sendMessages)

    //     writeFile(systoolsGlobalCacheFile, systoolsGlobal)
    // })

    // ctx.on('send', () => {
    //     const obj = systoolsGlobal.useFrequencys[new Date().getHours()]
    //     obj.sendMessages += 1
    //     obj.result = getUseFrequency(obj.commands, obj.receivedMessages, obj.sendMessages)

    //     writeFile(systoolsGlobalCacheFile, systoolsGlobal)
    // })

    const commands = ['systools', 'systools/system', 'systools/process', 'systools/debug',]

    for (let i = 0; i < commands.length; i++) {
        const command = commands[i]
        ctx.command(command, '当前可用的指令有:')
            .action(async ({ session }) => {
                const cmds = command.split('/')
                session.execute(`help ${cmds[cmds.length-1]}`)
            })
    }

    ctx.command('systools/update', '检查更新')
        .action(async ({ session }) => {
            return await update(ctx, (session as Session))
        })

    ctx.command('systools/systools-version', '获取当前插件版本 (基于读取 package.json)')
        .action(async ({ session }) => {
            return `版本: ${systoolsGlobal.packageJson['version'] ?? '0.0.0'}`
        })

    ctx.command('systools/system/ip', '获取 koishi 所在设备 IP')
        .action(async ({ session }) => {
            session.content = 'ping'
            return await session.execute('ping')
        })

    ctx.command('systools/system/ping [ip:text]', '使用 API ping 指定网站\n> 当不指定 IP 时, 获取 koishi 所在设备 IP')
        .action(async ({ session }, ip?: string) => {
            return await ping(ctx, (session as Session), ip)
        })

    ctx.command('systools/system/sysinfo', '获取系统运行信息')
        .action(async ({ session }) => {
            return await sysinfo(ctx, (session as Session))
        })

    ctx.command('systools/process/taskrun <command:text>', '使用 exec 运行系统命令\n> 注意: 运行的所有指令将直接应用于您的系统, 固最低权限为 3, 请您按需更改指令权限.\n> 同时, 该指令为实验性指令, 可能发生诸如 命令输出混乱 / 刷屏 / 杀死进程无效 等状况, 所造成的任何后果均需用户自行承担.', { authority: 3 })
        .action(async ({ session }) => {
            return await exec(ctx, (session as Session))
        })

    ctx.command('systools/process/taskkill', '杀死指定或所有未关闭进程(仅限由 taskrun 指令所运行的进程)\n当 pid 为空时杀死所有进程\n> 注意: 本指令最低权限为 3, 请您按需更改指令权限.', { authority: 3 })
        .option('pid', '-p [pid:posint] 指定进程的 PID')
        .action(async ({ session, options }) => {
            return await kill(ctx, (session as Session), options.pid)
        })

    ctx.command('systools/process/taskinput', '向指定进程(仅限由 taskrun 指令所运行的进程)输入内容\n> 注意: 本指令最低权限为 3, 请您按需更改指令权限.', { authority: 3 })
        .option('pid', '-p <pid:posint> 指定进程的 PID')
        .option('msg', '-m <msg:text> 输入的内容')
        .action(async ({ session, options }) => {
            return await input(ctx, (session as Session), options.pid, options.msg)
        })

    ctx.command('systools/process/tasklist', '获取进程列表(仅限由 taskrun 指令所运行的进程)')
        .option('pid', '-p [pid:posint] 获取指定进程 PID 的信息')
        .action(async ({ session, options }) => {
            return await list(ctx, (session as Session), options.pid)
        })

    ctx.on('dispose', () => {
        if (systoolsGlobal.eventsLoopIntervalId) {
            try {
                clearInterval(systoolsGlobal.eventsLoopIntervalId)
            } catch (error) {
                logger.debug(`clear events loop interval error: ${error}`)
            }
        }

        writeFile(systoolsGlobalCacheFile, systoolsGlobal)  // 更新 backupIntervalId 和/或 githubBackupIntervalId
    })

    if (process.env.NODE_ENV === 'development') {
        const debug = require('./debug/functions')

        // ctx.command('systools/debug/suse')  // 突然想写这个
        //     // o.O? 您看到 koishi 框架半夜重启是否十分奇怪? 不必担心, 这只是 systools 即为先进 (余大嘴音) 的自动更新功能, 会自动识别机器人使用频率最低的时端重启框架以应用更新\n系统检测到您在 ${key} 点到 ${key+1} 点(24小时制)使用频率最低, 我们将在该时段重启机器人框架以应用更新
        //     .action(() => {
        //         return debug.Object2String(systoolsGlobal.useFrequencys)
        //     })

        ctx.command('systools.debug.update')
            .action(() => {
                return debug.Object2String(systoolsGlobal.updateStatus)
            })

        ctx.command('systools.debug.events')
            .action(() => {
                return debug.Object2String(systoolsGlobal.eventsList)
            })
    }
}
