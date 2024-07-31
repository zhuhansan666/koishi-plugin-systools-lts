import { ChildProcessByStdio } from "child_process"
import { Session } from "koishi"
import { Writable, Readable } from "stream"
import { TelemetryEvent } from "koishi-plugin-lovemilk-telemetry"

import { Events } from "../events/events"

export type functionStatus = {
    status: number  // 0 -> no error
    data?: any  // the function result
    msg: 'success' | Error  // the error object
}

export type functionStatusPromise = Promise<functionStatus>

export type execProcess = {
    process: ChildProcessByStdio<Writable, Readable, Readable>,
    session: Session
}

export type systoolsGlobal = {
    systoolsGlobalCacheFile: string
    eventsLoopIntervalId: number,
    eventsList: Array<Events>,
    telemetryHistory: Array<TelemetryEvent>,
    updateStatus: UpdateStatus,
    telemetryHasTipedClients: Array<string>,  // string is the ID of browser
    packageJson: object,
}

export type UpdateStatus = {
    tiped: boolean  // 上次是否更新
    code: number  // 0 -> no error
    msg: 'isLatest' | 'updatedSuccessfully' | 'updateError' | 'init'
    desc: string
    timestamp: number  // 时间戳
    totalTried: number  // 连续尝试次数
    latest: string
}

export type ipAPIResult = {  // https://ip-api.com/docs/api:json
    status: 'success',
    continent: string,
    continentCode: string,
    country: string,
    countryCode: string,
    region: string,
    regionName: string,
    city: string,
    district: string,
    zip: string,
    lat: number,
    lon: number,
    timezone: string,
    offset: string,
    currency: string,
    isp: string,
    org: string,
    as: string,
    asname: string,
    reverse: string,
    mobile: string,
    proxy: string,
    hosting: string,
    query: string
} | {
    status: 'fail',
    message: string,
    query?: string
}
