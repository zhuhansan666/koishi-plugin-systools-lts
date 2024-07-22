export function Object2String(data: object, deep: number=0) {
    let result = ''
    const perfix = '\t'.repeat(deep)

    for (let key in data) {
        let value = data[key]
        if (typeof value !== 'object') {
            if (value === void 0) {
                value = 'undefined'
            } else if (value === null) {
                value = 'null'
            }

            result += `${perfix}${key}: ${value}\n`
            continue
        }

        result += `${perfix}${key}: \n${Object2String(value, deep + 1)}\n`
    }

    return result
}
