import { Logger } from "koishi"

import { defaultGlobal } from "./configs/configs"
import { execProcess } from "./types/types"

export const logger = new Logger('systools')

export const systoolsGlobal = Object.assign({}, defaultGlobal)
export const execProcesses: Array<execProcess> = []
