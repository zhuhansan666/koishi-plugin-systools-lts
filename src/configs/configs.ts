import { machineIdSync } from 'node-machine-id'

import { systoolsGlobal } from "../types/types"

export function getUseFrequency(commands: number, receivedMessages: number, sendMessages: number): number {
    return (commands * 50 + receivedMessages * 20 + sendMessages * 30) / 100
}

export const defaultGlobal: systoolsGlobal = {
    systoolsGlobalCacheFile: '',
    eventsLoopIntervalId: null,
    eventsList: [],
    telemetryHistory: [],
    updateStatus: {
        tiped: false,
        code: 0,
        msg: 'init',
        desc: '',
        timestamp: null,
        totalTried: 0,
        latest: '0.0.0'
    },
    telemetryHasTipedClients: [],
    packageJson: {},
}

export const ipAPI = 'http://ip-api.com/json/'
export const ipAPIArgs = `lang=zh-CN&fields=66846719`

export const machineId = machineIdSync(true)

export const maxTelemetryHistoryLength = 1024
