import { logger, systoolsGlobal } from "../share";
import { EventNames, EventsList } from "./events";


async function getEarliest(eventName: EventNames, eventsList: EventsList): Promise<number | null> {
    let min = null
    for (let i = 0; i < eventsList.length; i++) {
        const event = eventsList[i]
        if (!event.catched && event.name == eventName && event.flags.includes('keepEarliest') && (min === null || event.target < min)) {
            min = event.target
        }
    }

    return min
}

async function getLatest(eventName: EventNames, eventsList: EventsList): Promise<number | null> {
    let max = null
    for (let i = 0; i < eventsList.length; i++) {
        const event = eventsList[i]
        if (!event.catched && event.name == eventName && event.flags.includes('keepLatest') && (max === null || event.target > max)) {
            max = event.target
        }
    }

    return max
}

async function remove(eventName: EventNames, eventsList: EventsList, rule: 'keepLatest' | 'keepEarliest', target: number) {
    for (let i = 0; i < eventsList.length; i++) {
        const event = eventsList[i]
        if (!event.catched && event.name == eventName && event.flags.includes(rule)) {
            if ((rule === 'keepLatest' && event.target < target) || (rule === 'keepEarliest' && event.target > target)) {
                event.catched = true
            }
        }
    }
}

export const functions = {
    reload: null,
    checkUpdate: null,
    backup: null,
    githubBackup: null
}

export default async function loop(eventsList: EventsList) {
    eventsList.sort((a, b) => {
        return a.target > b.target ? 1 : 0
    })

    for (let i = 0; i < eventsList.length; i++) {
        const event = eventsList[i]
        if (!event) {
            continue
        }

        if (event.flags.includes('keepEarliest')) {
            const earliest = await getEarliest(event.name, eventsList)
            if (earliest) {
                remove(event.name, eventsList, 'keepEarliest', earliest)
            }
        } else if (event.flags.includes('keepLatest')) {
            const latest = await getLatest(event.name, eventsList)
            if (latest) {
                remove(event.name, eventsList, 'keepLatest', latest)
            }
        }
    }

    for (let i = 0; i < eventsList.length; i++) {
        const event = eventsList[i]
        if (!event) {
            continue
        }

        if (Date.now() >= event.target && !event.catched) {
            event.catched = true
            const func = functions[event.name]
            if (func) {
                try {
                    logger.debug(`运行 ${event.name} 事件的回调函数`)
                    await func()
                } catch (error) {
                    logger.warn(`运行 ${event.name} 事件的回调函数错误: ${error}`)
                }
            }
        }
    }
}