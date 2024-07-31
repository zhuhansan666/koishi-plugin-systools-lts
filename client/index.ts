import { Context } from '@koishijs/client'

import TelemetryDialog from './vue/TelemetryDialog.vue'

export default async(ctx: Context) => {
    ctx.slot({
        component: TelemetryDialog,
        type: 'global',
    })
}