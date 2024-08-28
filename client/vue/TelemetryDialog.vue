<template>
    <el-dialog v-model="dialogVisible" align-center :before-close="onCloseDialog" :z-index="1000">
        <el-card shadow="never" style="border: 0;">
            <template #header>
                <h1 style="margin-top: 0px; margin-bottom: 0px;">帮帮我们! 用户大人!</h1>
            </template>
            <el-form label-position="top">
                <el-form-item>
                    <el-text size="large">
                        您必须在选择前仔细阅读 <el-link type="primary" href="/lovemilk-telemetry/EULA" target="_blank">Lovemilk Telemetry 终端用户协议 & 隐私政策</el-link>, 否则, 您无权进行选择<br>
                        单击确认开启遥测即视为您已仔细阅读上述协议并同意其中所有条目. 插件将在保证用户隐私前提下, 上传必要的错误调试信息等<br>
                        单击取消关闭遥测后, 您仍可以修改 `{{ telemetryConfigName }}` 配置项以开启遥测<br>
                    </el-text>
                </el-form-item>
                <el-form-item label="请选择一个遥测客户端, 或单击取消按钮">
                    <el-select v-model="telemetryClient" placeholder="">
                        <el-option v-for="item in telemetryServiceOptions" :key="item.value" :label="item.label"
                            :value="item.value" :disabled="item.disabled" />
                    </el-select>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-checkbox v-model="neverShowAgain" label="此浏览器不再提示本消息, 包括无痕模式 (该功能依赖浏览器指纹)" style="margin-bottom: 16px;" /><br>
                <el-button type="primary" @click="submit(true)">确认</el-button>
                <el-button type="primary" @click="submit(false)">取消</el-button>
            </template>
        </el-card>
    </el-dialog>
</template>

<script setup lang="ts">
import { } from 'koishi-plugin-systools-lts'
import { useContext, Context, send, store } from '@koishijs/client';
import { } from '@koishijs/plugin-config'
import { ref } from 'vue';
import { ElMessageBox } from 'element-plus'

import FingerprintJS from '@fingerprintjs/fingerprintjs'

async function getFingerprint() {
    const fp = await FingerprintJS.load()
    const fingerprint = await fp.get()

    return fingerprint.visitorId
}

let fingerprint = null

const isDev = process.env.NODE_ENV === 'development'
const telemetryConfigName = 'telemetryClient'

const dialogVisible = ref<boolean>(false)
const neverShowAgain = ref<boolean>(true)
const telemetryClient = ref<string>('')  // 用户选择的遥测服务平台
const telemetryServiceOptions = []  // 所有可用的遥测服务平台

const ctx: Context = useContext();
const getCurrentRoute = () => { return ctx.$router.router.currentRoute.value }
// {name: config}, if name startswith `~`, it was disabled. And if name startswith `group`, it was a group whose content like this.
const plugins = store.config.plugins
const systoolsPluginId = getPluginId('systools-lts', plugins, true)
let lastRoute = ''

function getPluginId(name: string, plugins: object, enableRequired: boolean = true): string {
    for (let pluginName in plugins) {
        if (pluginName.startsWith('$')) {
            continue
        }

        if (pluginName.startsWith('~')) {
            if (enableRequired) {
                continue
            } else {
                pluginName = pluginName.substring(1)
            }
        }

        if (pluginName.startsWith('group:')) {
            const result = getPluginId(name, plugins[pluginName], enableRequired)
            if (result) {
                return result
            }
        }

        if (pluginName.startsWith(`${name}:`)) {
            return pluginName.split(':')[1]
        }
    }
}

async function submit(enable: boolean) {
    timeout ? clearTimeout(timeout) : null  // 清除 showDialog 定时器

    if (fingerprint && neverShowAgain.value) {
        await send('systools-lts/telemetry-has-tripped', fingerprint)
    }

    const selectedTelemetryClient = enable ? (telemetryClient.value as typeof systoolsConfig[typeof telemetryConfigName]) : 'false'
    console.debug(`selected telemetry client: ${selectedTelemetryClient}`)

    dialogVisible.value = false

    const systoolsConfig = await send('systools-lts/config')
    if (systoolsConfig[telemetryConfigName] === selectedTelemetryClient) {
        return  // 无需更新配置
    }
    systoolsConfig[telemetryConfigName] = selectedTelemetryClient
    await send('manager/reload', '', `systools-lts:${systoolsPluginId}`, systoolsConfig)
}

async function showDialog() {
    nextLoop()
    const currentRoute = getCurrentRoute()

    if (lastRoute === currentRoute.fullPath) {
        return  // 避免重复弹窗
    } else {
        lastRoute = currentRoute.fullPath
    }

    const splitedPath = currentRoute.path.split('/')
    const routerPluginId = splitedPath[splitedPath.length - 1]
    if (currentRoute.name !== 'config' || routerPluginId !== systoolsPluginId) {
        return
    }

    const systoolsConfig = await send('systools-lts/config')
    if (systoolsConfig?.telemetryClient !== 'false') {
        return
    }

    fingerprint = await getFingerprint()
    console.debug(`fingerprint: ${fingerprint}`)
    if (!isDev && await send('systools-lts/telemetry-has-tripped', fingerprint, true)) {
        return
    }

    let telemetryServices = null
    try {
        telemetryServices = await send('systools-lts/telemetry-services')
        if (!(telemetryServices instanceof Array) || !telemetryServices.length) {
            throw new Error(
                `invalid response of telemetry services, expected an \`string[]\` but got \`${typeof telemetryServices}\` (${telemetryServices})`
            )
        }
    } catch (e) {
        console.error('get telemetry services failed', e)
        ElMessageBox.alert(
            '无法获取到遥测服务平台列表, 请稍后再试',
            '错误',
            {
                confirmButtonText: '确定',
                dangerouslyUseHTMLString: true,
            }
        )
        return
    }

    telemetryServices = telemetryServices.filter((meta) => meta.value !== 'false')

    telemetryClient.value = telemetryServices[0].value  // default value
    telemetryServiceOptions.splice(
        0,
        telemetryServiceOptions.length,
        ...telemetryServices.map(
            (meta) => { return { 
                value: meta.value,
                label: `${meta.description} ${meta.experimental ? ' (实验性) ' : ''} ${meta.deprecated ? ' (已弃用) ' : ''}`.trim(),
                disabled: meta.disabled,
            } }
        )
    )
    
    dialogVisible.value = true
}

function onCloseDialog(done: () => void) {
    ElMessageBox.confirm(
        `真的要关闭此窗口吗?<br>关闭后, 您仍可以修改 \`${telemetryConfigName}\` 配置项以开启遥测帮助我们`,
        '警告',
        {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            dangerouslyUseHTMLString: true
        }
    )
        .then(async () => {
            done()

            if (fingerprint && neverShowAgain.value) {
                await send('systools-lts/telemetry-has-tripped', fingerprint)
            }
        })
}

const nextLoop = () => {
    timeout = setTimeout(showDialog, 333)
}

let timeout = null
showDialog()
nextLoop()
</script>
