// TODO: 使用 Github API 备份文件
import { Context } from "koishi"
import {} from '@koishijs/plugin-http'
import path from "path"
import { stat as fsStat } from "fs/promises"

import { repoInfo, createRepo, upload, remove, searchFileByName, repoFilesinfo, repoFileinfo, repoDirInfo } from "./githubAPI"
import { Config } from ".."
import { logger } from "../share"
import { readFile } from "./fs"

async function create(ctx: Context, username: string, repoName: string, token: string) {
    const { status: repoInfoStatus, data: repoInfoData, msg: repoInfoMsg } = await repoInfo(ctx, username, repoName, token)

    if (repoInfoStatus > 0 && (!repoInfoData || repoInfoData.message)) {
        logger.info(`用户 ${username} 的 ${repoName} 仓库不存在, 开始创建`)
    } else if (repoInfoStatus == 0 && repoInfoData && !repoInfoData.private) {
        logger.warn(`用户 ${username} 的 ${repoName} 仓库存在但非私有, 不符合标准, 请更改仓库名或将其设为私有后重试`)
        return -1
    } else if (repoInfoStatus < 0) {
        logger.warn(`用户 ${username} 的 ${repoName} 仓库信息获取失败: ${repoInfoMsg}`)
    } else {
        logger.info(`用户 ${username} 的 ${repoName} 存在且仓库私有, 符合标准, 跳过创建`)
        return
    }

    const { status: createRepoStatus, data: createRepoData, msg: createRepoMsg } = await createRepo(ctx, token, repoName, true)
    if (createRepoStatus > 0) {
        logger.warn(`创建仓库错误: %j`, createRepoData)
        return -1
    } else if (createRepoStatus < 0) {
        logger.warn(`创建仓库错误: ${createRepoMsg}`)
        return -1
    }

    logger.info(`创建仓库成功`)
    logger.debug(`%j`, createRepoData)
}

async function getFileBase64(filename: string): Promise<string | null> {
    const { status, data, msg } = await readFile(filename, 'base64')

    if (status != 0) {
        logger.warn(`读取最新备份文件失败: %j ${msg}`, data)
        return null
    }
    try {
        return data
    } catch (error) {
        logger.warn(`将最新备份文件转为 base64 失败: ${error}`)
        return null
    }
}

async function githubUpload(ctx: Context, fileBase64: string, filename: string, _path: string, token: string, username: string, repoName: string) {
    const { status: fileInfoStatus, data: fileInfoData, msg: message } = await repoFilesinfo(ctx, username, repoName, path.resolve(_path, filename), token)
    let sha = null
    if (!fileInfoStatus && fileInfoData.type == 'file') {
        sha = fileInfoData.sha
    }

    const { status, data, msg } = await upload(ctx, fileBase64, token, username, repoName, filename, _path, sha)
    if (status > 0) {
        logger.warn(`上传文件 ${username}/${repoName}/${_path}/${filename} 错误: %j`, data)
        return -1
    } else if (status < 0) {
        logger.warn(`上传文件 ${username}/${repoName}/${_path}/${filename} 错误: ${msg}`)
        return -1
    }

    logger.info(`文件 ${username}/${repoName}/${_path}/${filename} 上传成功`)
}

export async function githubBackup(ctx: Context, filename: string, githubPath: string) {
    const config: Config = ctx.config
    const username = config.githubUsername
    const repoName = config.repoName
    const token = config.githubToken

    logger.info(`尝试将备份上传至 Github`)

    const fileStat = await fsStat(filename)
    if (fileStat.size <= config.skipEmptyThreshold) {
        logger.info(`文件 ${filename} 小于等于 ${config.skipEmptyThreshold} 字节, 跳过上传`)
        return
    }

    if (await create(ctx, username, repoName, token)) {  // return 0 时 false, 不退出函数
        logger.info(`备份异常退出`)
        return
    }
    const fileBase64 = await getFileBase64(filename)
    if (!fileBase64) {
        logger.info(`备份异常退出`)
        return
    }
    // logger.debug(`file base64: ${fileBase64}`)

    const parsedName = path.parse(filename)
    const githubFilename = `${parsedName.base}.${Date.now()}.bak`

    if (await githubUpload(ctx, fileBase64, githubFilename, githubPath, token, username, repoName)) {
        logger.info(`备份异常退出`)
        return
    }

    githubRemove(ctx, githubPath)

    logger.info(`备份成功! 本次备份流程结束`)
}

export async function githubRemove(ctx: Context, githubPath: string) {
    const config: Config = ctx.config
    const username = config.githubUsername
    const repoName = config.repoName
    const token = config.githubToken

    const { status, data: repoData, msg } = await repoFilesinfo(ctx, username, repoName, githubPath, token)
    if (status) {
        logger.warn(`删除文件时获取仓库信息错误: %j ${msg}`, repoData)
        return
    }

    const files = []
    for (let i = 0; i < repoData.length; i++) {
        const f: repoFileinfo | repoDirInfo = repoData[i]
        if (f.type === 'file') {
            files.push(f)
        }
    }

    let targetFiles: Array<repoFileinfo> = null
    if (files.length > config.keepGithubBackupFiles) {
        targetFiles = files.slice(files.length - config.keepGithubBackupFiles)
    } else {
        return
    }

    for (let i = 0; i < targetFiles.length; i++) {
        const targetFile = targetFiles[i]
        const sha = targetFile.sha

        logger.debug(`GitHub 文件备份达到上限 (${files.length} > ${config.keepGithubBackupFiles}) 尝试删除 ${username}/${repoName}/${githubPath}/${targetFile.name}`)

        const { status: removeStatus, data: removeData, msg: removeMsg } = await remove(ctx, sha, token, username, repoName, `${githubPath}/${targetFile.name}`)
        if (removeStatus) {
            logger.warn(`删除文件错误: %j`, removeData)
            continue
        }

        logger.debug(`文件删除成功`)
    }
}
