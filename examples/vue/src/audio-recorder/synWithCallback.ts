import type { MaybeRefOrGetter } from 'vue'
import { ref, toValue } from 'vue'

type CallbackFunction<T> = (newVal: T) => unknown
export const useSyncState = <T> (initialValue: MaybeRefOrGetter<T>, callback?: Nullable<CallbackFunction<T>>) => {
  const value = ref(toValue(initialValue))
  const setValue = (newValue: T) => {
    value.value = newValue
    callback?.(newValue)
  }

  return [value, setValue] as const
}
