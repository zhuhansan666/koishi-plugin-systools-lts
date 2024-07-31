<template>
    <el-dialog v-model="dialogVisible" align-center :before-close="onCloseDialog">
        <el-card shadow="never">
            <template #header>
                <h2 style="margin-top: 0px; margin-bottom: 0px;">帮帮我们! 用户大人!</h2>
            </template>
            <el-text size="large">
                您必须在选择前仔细阅读 <el-link type="primary" href="/lovemilk-telemetry/EULA" target="_blank">Lovemilk Telemetry 终端用户协议 & 隐私政策</el-link>, 否则, 您无权进行选择<br>
                单击确认开启遥测即视为您已仔细阅读上述协议并同意其中所有条目. 插件将在保证用户隐私前提下, 上传必要的错误调试信息等<br><br>
                单击取消关闭遥测后, 您仍可以修改 `allowTelemetry` 配置项以开启遥测<br>
            </el-text>
            <template #footer>
                <el-checkbox v-model="neverShowAgain" label="此浏览器不再提示本消息" style="margin-bottom: 16px;"/><br>
                <el-button type="primary" @click="submit(true)">确认</el-button>
                <el-button type="primary" @click="submit(false)">取消</el-button>
            </template>
        </el-card>
    </el-dialog>
</template> 

<script setup lang="ts">
import { Config } from 'koishi-plugin-systools-lts'
import { useContext, Context, send, store } from '@koishijs/client';
import {} from '@koishijs/plugin-config'
import { ref } from 'vue';
import { ElMessageBox } from 'element-plus'

import FingerprintJS from '../static/fingerprintJSv4.js'

async function getFingerprint() {
    const fp = await FingerprintJS.load()
    const fingerprint = await fp.get()

    return fingerprint.visitorId
}

let fingerprint = null

const dialogVisible = ref(false)
const neverShowAgain = ref(true)

const ctx: Context = useContext();
const currentRoute = ctx.$router.router.currentRoute.value
// {name: config}, if name startswith `~`, it was disabled. And if name startswith `group`, it was a group whose content like this.
const plugins = store.config.plugins
const systoolsPluginId = getPluginId('systools-lts', plugins, true)

function getPluginId(name: string, plugins: object, enableRequired: boolean=true): string {
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
    if (fingerprint && neverShowAgain.value) {
        await send('systools-lts/telemetry-has-tripped', fingerprint)
    }

    const systoolsConfig = await send('systools-lts/config')

    dialogVisible.value = false
    systoolsConfig['allowTelemetry'] = !!enable
    await send('manager/reload', '', `systools-lts:${systoolsPluginId}`, systoolsConfig)
}

async function showDialog() {
    const splitedPath = currentRoute.path.split('/')
    const routerPluginId = splitedPath[splitedPath.length - 1]
    if (currentRoute.name !== 'config' || routerPluginId !== systoolsPluginId) {
        return
    }

    const systoolsConfig = await send('systools-lts/config')
    if (systoolsConfig?.allowTelemetry === true) {
        return
    }

    fingerprint = await getFingerprint()
    console.debug(`fingerprint: ${fingerprint}`)
    if (await send('systools-lts/telemetry-has-tripped', fingerprint, true)) {
        return
    }

    dialogVisible.value = true
}

function onCloseDialog(done:() => void) {
    ElMessageBox.confirm(
        '真的要关闭此窗口吗?<br>关闭后, 您仍可以修改 `allowTelemetry` 配置项以开启遥测帮助我们',
        '警告',
        {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            dangerouslyUseHTMLString: true,
        }
    )
        .then(async() => {
            done()
            
            if (fingerprint && neverShowAgain.value) {
                await send('systools-lts/telemetry-has-tripped', fingerprint)
            }
        })
}
showDialog()
</script>
