import { Context } from "koishi"
import {} from '@koishijs/plugin-http'

import { functionStatusPromise } from "../types/types"
import { Config } from ".."

/*
https://segmentfault.com/a/1190000015144126

首先！访问的链接最后不能有/。如https://api.github.com/users/solomonxie是可以访问到我个人信息的，但是https://api.github.com/users/solomonxie/就不行了，唯一不同是多了一个/.
其次！不同于一般URL访问，Github的API访问链接是区分大小写的！
个人主要信息。 https://api.github.com/users/用户名
*/


function post(ctx: Context, url: string, token?: string, data?: object, options?: object) {
    const config: Config = ctx.config
    return ctx.http.post(
        url,
        data,
        {
            timeout: config.axiosConfig ? config.axiosTimeout : null,
            validateStatus: () => { return true },
            headers: {
                Authorization: `token ${token}`  // 使用 token 可跳过登录验证
            },
            ...options
        }
    )
}

function get(ctx: Context, url: string, token?: string, data?: object, options?: object) {
    const config: Config = ctx.config
    return ctx.http.axios(
        url,
        {
            params: data,
            timeout: config.axiosConfig ? config.axiosTimeout : null,
            validateStatus: () => { return true },
            headers: {
                Authorization: `token ${token}`  // 使用 token 可跳过登录验证
            },
            ...options
        }
    )
}

export async function createRepo(
    ctx: Context,
    token: string,
    repoName: string,
    privateRepo: boolean = true
): functionStatusPromise {

    try {
        const data = await post(
            ctx,
            'https://api.github.com/user/repos',
            token,
            { name: repoName, private: privateRepo }
        )

        return {
            status: data.errors ? 1 : 0,
            data: data,
            msg: 'success'
        }
    } catch (error) {
        return {
            status: -1,
            msg: error
        }
    }

}

export type repoInfo = {
    id: number,
    node_id: string,
    name: string,  // like koishi-plugin-systools
    full_name: string,  // like zhuhansan666/koishi-plugin-systools
    private: boolean,
    owner: any,  // 没必要去写完整, 反正就是判断下有没有仓库, 是不是私有的
    html_url: string,  // like https://github.com/zhuhansan666/koishi-plugin-systools
    description: string,
    fork: boolean,
    language: string  // such as TypeScript
} | {
    message: 'Not Found' | string,
    documentation_url: string
}

export async function repoInfo(
    ctx: Context,
    username: string,
    repoName: string,
    token?: string,
): functionStatusPromise {
    /**
     * @param repoOwner like zhuhansan666
     * @param repoName like koishi-plugin-systools
     */

    try {
        const request = await get(
            ctx,
            `https://api.github.com/repos/${username}/${repoName}`,
            token
        )
        const data: repoInfo = request.data

        return {
            status: request.status >= 200 && request.status < 400 ? 0 : 1,
            data: data,
            msg: 'success'
        }
    } catch (error) {
        return {
            status: -1,
            msg: error
        }
    }
}


export type repoFileinfo = {
    name: string,  // readme.md
    path: string,  // readme.md
    sha: string,  // 438846711fb8e7b2c563c29966e02a601d3f6ecb
    size: number,  // 1234
    url: string,  //  https://api.github.com/repos/zhuhansan666/koishi-plugin-systools/contents/readme.md?ref=master
    html_url: string,  // https://github.com/zhuhansan666/koishi-plugin-systools/blob/master/readme.md
    git_url: string,  // https://api.github.com/repos/zhuhansan666/koishi-plugin-systools/git/blobs/438846711fb8e7b2c563c29966e02a601d3f6ecb
    download_url: string, // https://raw.githubusercontent.com/zhuhansan666/koishi-plugin-systools/master/readme.md
    type: "file"
    _links: {
        self: string,  // https://api.github.com/repos/zhuhansan666/koishi-plugin-systools/contents/readme.md?ref=master
        git: string,  // https://api.github.com/repos/zhuhansan666/koishi-plugin-systools/git/blobs/438846711fb8e7b2c563c29966e02a601d3f6ecb
        html: string,  // https://github.com/zhuhansan666/koishi-plugin-systools/blob/master/readme.md
    }
}

export type repoDirInfo = {
    name: string,  // src
    path: string,  // src
    sha: string,  // 0a1f416c83a96fb57c9159d87f1bf8031fc53392
    size: 0,
    url: string,  // https://api.github.com/repos/zhuhansan666/koishi-plugin-systools/contents/src?ref=master
    html_url: string,  // https://github.com/zhuhansan666/koishi-plugin-systools/tree/master/src
    git_url: string,  // https://api.github.com/repos/zhuhansan666/koishi-plugin-systools/git/trees/0a1f416c83a96fb57c9159d87f1bf8031fc53392
    download_url: null,
    type: "dir"
    _links: {
        self: string,  // https://api.github.com/repos/zhuhansan666/koishi-plugin-systools/contents/src?ref=master
        git: string,  // https://api.github.com/repos/zhuhansan666/koishi-plugin-systools/git/trees/0a1f416c83a96fb57c9159d87f1bf8031fc53392
        html: string,  // https://github.com/zhuhansan666/koishi-plugin-systools/tree/master/src
    }
}


export async function repoFilesinfo(
    ctx: Context,
    username: string,
    repoName: string,
    path: string,
    token?: string,
): functionStatusPromise {
    /**
     * @param username  结尾开头不能带 `/`, zhuhansan666
     * @param repoName 结尾开头不能带 `/`, koishi-plugin-systools
     * @param path 结尾开头不能带 `/`, src
     */

    try {
        const request = await get(
            ctx,
            `https://api.github.com/repos/${username}/${repoName}/contents/${path}`,
            token
        )
        const data: Array<repoFileinfo | repoDirInfo> = request.data

        return {
            status: request.status >= 200 && request.status < 400 ? 0 : 1,
            data: data,
            msg: 'success'
        }
    } catch (error) {
        return {
            status: -1,
            msg: error
        }
    }
}

export async function upload(  // https://docs.github.com/zh/rest/repos/contents#create-or-update-file-contents
    ctx: Context,
    fileBase64: string,
    token: string,
    username: string,
    repoName: string,
    filename: string,
    path: string = '',
    sha?: string,
    branch?: string,
): functionStatusPromise {

    try {
        const data = await ctx.http.put(
            `https://api.github.com/repos/${username}/${repoName}/contents/${path}/${filename}`,
            {
                message: 'auto upload',
                // committer: {
                //     name: username,
                //     email: `${username}@outlook.com` //  这边不知道 Github 要不要验证邮箱, 先随便写下
                // },
                content: fileBase64,
                branch: branch,
                sha: sha
            }, {
            headers: {
                Authorization: `token ${token}`
            },
            timeout: ctx.config.axiosConfig ? ctx.config.axiosTimeout : null,
            validateStatus: () => { return true },
        }
        )

        return {
            status: data['message'] ? 1 : 0,
            data: data,
            msg: 'success'
        }
    } catch (error) {
        return {
            status: -1,
            msg: error
        }
    }
}

// 20230813 22:18:32 +0800 总算被我找到文档了
export async function remove(  // https://docs.github.com/zh/rest/repos/contents#delete-a-file
    ctx: Context,
    fileSha: string,
    token: string,
    username: string,
    repoName: string,
    path: string = '',
    branch?: string,
): functionStatusPromise {
    const config: Config = ctx.config

    try {
        const data = await ctx.http.delete(
            `https://api.github.com/repos/${username}/${repoName}/contents/${path}`,
            {
                params: {
                    message: 'auto remove',
                    // committer: {
                    //     name: username,
                    //     email: `${username}@outlook.com` //  这边不知道 Github 要不要验证邮箱, 先随便写下
                    // },
                    sha: fileSha,
                    branch: branch
                },
                headers: {
                    Authorization: `token ${token}`
                },
                timeout: config.axiosConfig ? config.axiosTimeout : null,
                validateStatus: () => { return true },
            }
        )

        return {
            status: data['message'] ? 1 : 0,
            data: data,
            msg: 'success'
        }
    } catch (error) {
        return {
            status: -1,
            msg: error
        }
    }
}

export async function searchFileByName(data: Array<repoFileinfo | repoDirInfo>, filename: string): Promise<repoFileinfo | repoDirInfo | null> {
    for (let i; i < data.length; i++) {
        const item = data[i]
        if (item.type == 'file' && item.name === filename) {
            return item
        }
    }

    return null
}
