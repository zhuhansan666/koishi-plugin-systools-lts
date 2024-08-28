export type BaseEvent = {
    name: string,
    target: number,  // 时间戳
    flags: flags,
    caught: boolean
}

export type flags = Array<
    'none' | 'keepLatest' | 'keepEarliest' | 'clearAfterReload'
>

export type ReloadEvent = {
    name: 'reload',
    target: number,
    flags: flags,
    caught: boolean
}

export type CheckUpdateEvent = {
    name: 'checkUpdate',
    target: number,
    flags: flags,
    caught: boolean
}

export type BackupEvent = {
    name: 'backup',
    target: number,
    flags: flags,
    caught: boolean
}

export type GitHubBackupEvent = {
    name: 'githubBackup',
    target: number,
    flags: flags,
    caught: boolean
}

export type Events = ReloadEvent | BaseEvent | CheckUpdateEvent | BackupEvent | GitHubBackupEvent
export type EventNames = 'reload' | 'checkUpdate' | 'backup' | 'githubBackup' | string
export type EventsList = Array<Events>
