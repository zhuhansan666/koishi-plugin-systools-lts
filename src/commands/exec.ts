import { spawn, exec as cpExec1 } from 'child_process'
import { promisify } from 'util'
import { Session, Context, h } from "koishi"
const cpExec = promisify(cpExec1)

import { logger, execProcesses as shareExecProcesses } from '../share'
import { Config } from '..'

function execute(command: string, callback: Function, args?: Array<string>, timeout: number = 0) {
    let firstKilled = true

    const cmd = spawn(command, args, { timeout: timeout, shell: true })
    cmd['command'] = command

    cmd.stdout.on('data', (data) => {
        if (!cmd.killed) {
            callback(data, 'stdout')
        } else {
            if (firstKilled) {
                callback(0, 'close')
            }
            firstKilled = false
        }
    })
    cmd.stderr.on('data', (data) => {
        if (!cmd.killed) {
            callback(data, 'stderr')
        } else {
            if (firstKilled) {
                callback(0, 'close')
            }
            firstKilled = false
        }
    })

    cmd.on('close', (code) => {
        callback(code, 'close')
    })

    return cmd
}

function getString(data) {
    if (data.toString().includes('�')) {
        const decoder = new TextDecoder(process.platform == 'win32' ? 'GBK' : 'UTF-8')
        return decoder.decode(data)
    } else {
        return data.toString()
    }
}

export default async function exec(ctx: Context, session: Session, errorCallback: (session: Session, msg: string | Error) => void) {
    const execProcesses = shareExecProcesses
    const config: Config = ctx.config

    const koishiCommandLength = session.content.split(' ', 1)[0].length
    const rawCommand = h('', h.parse(session.content.slice(koishiCommandLength + 1))).toString(true)  // 这边 +1 是为了删除空格
    
    if (rawCommand.length <= 0 || rawCommand.trim().length <= 0) {
        errorCallback(session, '错误的语法: 指令为空')
        return '错误的语法: 指令为空'
    }

    if (config.enableExec) {
        session.send(`开始运行, 请坐和放宽\n${rawCommand}`)

        try {
            let { stdout, stderr } = await cpExec(
                // process.platform == 'win32' ? `cmd /d /s /c ${rawCommand}` : rawCommand,  // 不知道为什么运行 cmd 指令(非可执行文件)就是不行, 摆烂啦
                rawCommand,
                { windowsHide: true, encoding: 'buffer' }
            )

            stdout = getString(stdout)
            stderr = getString(stderr)

            return `指令输出\n${stdout}\n${stderr}`
        } catch (error) {
            errorCallback(session, error)
            return `指令运行错误: ${error.stack}`
        }

    }


    const cmd = execute(rawCommand, (data, status: 'stdout' | 'stderr' | 'close') => {
        if (status == 'close') {
            for (let i = 0; i < execProcesses.length; i++) {
                const myProcess = (execProcesses[i] ?? {}).process  // 区别于 nodejs 的 process
                const mySession = (execProcesses[i] ?? {}).session
                const pid = (myProcess ?? {}).pid
                if (cmd.pid == pid) {
                    execProcesses.splice(i, 1)
                }
            }

            session.sendQueued(`${rawCommand} ${cmd.pid}: 进程已退出, 退出状态码: ${data}`)
            return
        }

        session.sendQueued(`${rawCommand} ${cmd.pid}:\n${getString(data)}`)
    })
    execProcesses.push({ process: cmd, session: session })

    return `开始运行, 请坐和放宽\n${rawCommand} (PID: ${cmd.pid})`
}

export async function kill(ctx: Context, session: Session, errorCallback: (session: Session, msg: string | Error) => void, targetPid?: number) {
    const killed = []
    const killFailed = []

    const execProcesses = shareExecProcesses

    for (let i = 0; i < execProcesses.length; i++) {
        const myProcess = (execProcesses[i] ?? {}).process  // 区别于 nodejs 的 process
        const mySession = (execProcesses[i] ?? {}).session
        const pid = (myProcess ?? {}).pid

        if (!targetPid || (targetPid === pid)) {
            if (myProcess) {
                try {
                    const status = await myProcess.kill('SIGINT')
                    // const status = await process.kill('SIGHUP')
                    session.cancelQueued()

                    if (status && myProcess.killed) {
                        if (pid) {
                            killed.push(pid)
                        }
                        execProcesses.splice(i, 1)  // 移除已经关闭的进程
                    } else {
                        if (pid) {
                            killFailed.push(pid)
                        }
                    }
                } catch (error) {
                    if (pid) {
                        killFailed.push(pid)
                    }
                    errorCallback(session, `kill ${pid} error: ${error.stack}`)
                    logger.warn(`kill ${pid} error: ${error.stack}`)
                }
            } else {
                logger.warn(`process is ${myProcess}`)
            }
        }
    }

    return `杀死如下进程成功:\n${killed.join(', ')}\n杀死如下进程失败:\n${killFailed.join(', ')}\n`
}

export async function input(ctx: Context, session: Session, pid: number, msg: string, errorCallback: (session: Session, msg: string | Error) => void) {
    if (!pid) {
        errorCallback(session, '缺少参数: pid')
        return '缺少参数: pid'
    }else if (!msg) {
        errorCallback(session, '缺少参数: msg')
        return '缺少参数: msg'
    }
    const execProcesses = shareExecProcesses

    for (let i = 0; i < execProcesses.length; i++) {
        const myProcess = (execProcesses[i] ?? {}).process
        const mySession = (execProcesses[i] ?? {}).session
        if (myProcess.pid === pid) {
            myProcess.stdin.once('data', (data) => {
                session.send(getString(data))
            })
            myProcess.stderr.once('data', (data) => {
                session.send(getString(data))
            })

            myProcess.stdin.write(`${msg}\n`, async (error) => {
                if (error) {
                    errorCallback(session, `输入错误:\n${error.stack}`)
                    session.send(`输入错误:\n${error.stack}`)
                } else {
                    session.send(`输入成功`)
                }
            })
            return
        }
    }

    return `未运行或已关闭的进程 ${pid}, 请确认 PID 是否属实`
}

export async function list(ctx: Context, session: Session, pid?: number) {
    const execProcesses = shareExecProcesses

    let result = '| PID\t\t| 会话 ID\t\t| 状态\t| 命令\t\t\n'

    for (let i = 0; i < execProcesses.length; i++) {
        const myProcess = (execProcesses[i] ?? {}).process
        const mySession = (execProcesses[i] ?? {}).session
        if (!pid || myProcess.pid === pid) {
            result += `| ${myProcess.pid}\t\t| ${mySession.id}\t\t| ${myProcess.killed ? '已结束' : '正运行'}\t\t| ${myProcess['command']}\n`
            if (!pid) {
                return result
            }
        }
    }

    return result
}
