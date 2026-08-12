<template>
  <section class="mailSettings" aria-labelledby="mail-settings-title">
    <header class="mailSettingsHeader">
      <div>
        <p>MAIL CONNECTION</p>
        <h3 id="mail-settings-title">邮箱设置</h3>
      </div>
      <ShieldCheck :size="21" :stroke-width="1.6" aria-hidden="true" />
    </header>

    <form @submit.prevent="saveConfig">
      <section class="mailIdentitySettings">
        <header>
          <div>
            <p>IDENTITY</p>
            <h4>发件身份</h4>
          </div>
        </header>
        <div class="mailFields is-identity">
          <label class="mailField">
            <span>邮箱地址</span>
            <input v-model.trim="form.address" type="email" autocomplete="email" required placeholder="name@example.com" />
          </label>
          <label class="mailField">
            <span>显示名称</span>
            <input v-model.trim="form.displayName" type="text" autocomplete="name" maxlength="80" />
          </label>
        </div>
      </section>

      <div class="mailProtocolGrid">
        <section class="mailProtocol">
          <header>
            <div class="mailProtocolTitle">
              <Inbox :size="18" :stroke-width="1.7" aria-hidden="true" />
              <span><p>INCOMING</p><h4>IMAP</h4></span>
            </div>
            <span class="mailTlsBadge"><LockKeyhole :size="12" :stroke-width="1.8" aria-hidden="true" />TLS · 993</span>
          </header>
          <div class="mailFields">
            <label class="mailField is-wide">
              <span>服务器</span>
              <input v-model.trim="form.imap.host" type="text" autocomplete="off" required placeholder="imap.example.com" />
            </label>
            <label class="mailField is-wide">
              <span>用户名</span>
              <input v-model.trim="form.imap.username" type="text" autocomplete="username" required />
            </label>
            <label class="mailField is-wide">
              <span>密码</span>
              <div class="mailSecretInput">
                <input
                  v-model="form.imap.password"
                  :type="showImapPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  :disabled="form.imap.clearPassword"
                  :placeholder="form.imap.passwordConfigured ? '留空以保留已保存密码' : '请输入密码'"
                />
                <button type="button" :title="showImapPassword ? '隐藏密码' : '显示密码'" :aria-label="showImapPassword ? '隐藏密码' : '显示密码'" @click="showImapPassword = !showImapPassword">
                  <EyeOff v-if="showImapPassword" :size="15" :stroke-width="1.7" aria-hidden="true" />
                  <Eye v-else :size="15" :stroke-width="1.7" aria-hidden="true" />
                </button>
              </div>
              <span class="mailCredentialState">
                <small>{{ passwordState(form.imap) }}</small>
                <label v-if="form.imap.passwordConfigured"><input v-model="form.imap.clearPassword" type="checkbox" @change="handleClearPassword(form.imap)" />清除密码</label>
              </span>
            </label>
          </div>
          <footer>
            <span :class="testState.imap.kind">{{ testState.imap.message }}</span>
            <button type="button" :disabled="testingTarget !== ''" @click="testConnection('imap')">
              <LoaderCircle v-if="testingTarget === 'imap'" class="is-spinning" :size="14" :stroke-width="1.8" aria-hidden="true" />
              <PlugZap v-else :size="14" :stroke-width="1.8" aria-hidden="true" />
              <span>测试 IMAP</span>
            </button>
          </footer>
        </section>

        <section class="mailProtocol">
          <header>
            <div class="mailProtocolTitle">
              <Send :size="18" :stroke-width="1.7" aria-hidden="true" />
              <span><p>OUTGOING</p><h4>SMTP</h4></span>
            </div>
            <span class="mailTlsBadge"><LockKeyhole :size="12" :stroke-width="1.8" aria-hidden="true" />TLS · 465</span>
          </header>
          <div class="mailFields">
            <label class="mailField is-wide">
              <span>服务器</span>
              <input v-model.trim="form.smtp.host" type="text" autocomplete="off" required placeholder="smtp.example.com" />
            </label>
            <label class="mailField is-wide">
              <span>用户名</span>
              <input v-model.trim="form.smtp.username" type="text" autocomplete="username" required />
            </label>
            <label class="mailField is-wide">
              <span>密码</span>
              <div class="mailSecretInput">
                <input
                  v-model="form.smtp.password"
                  :type="showSmtpPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  :disabled="form.smtp.clearPassword"
                  :placeholder="form.smtp.passwordConfigured ? '留空以保留已保存密码' : '请输入密码'"
                />
                <button type="button" :title="showSmtpPassword ? '隐藏密码' : '显示密码'" :aria-label="showSmtpPassword ? '隐藏密码' : '显示密码'" @click="showSmtpPassword = !showSmtpPassword">
                  <EyeOff v-if="showSmtpPassword" :size="15" :stroke-width="1.7" aria-hidden="true" />
                  <Eye v-else :size="15" :stroke-width="1.7" aria-hidden="true" />
                </button>
              </div>
              <span class="mailCredentialState">
                <small>{{ passwordState(form.smtp) }}</small>
                <label v-if="form.smtp.passwordConfigured"><input v-model="form.smtp.clearPassword" type="checkbox" @change="handleClearPassword(form.smtp)" />清除密码</label>
              </span>
            </label>
          </div>
          <footer>
            <span :class="testState.smtp.kind">{{ testState.smtp.message }}</span>
            <button type="button" :disabled="testingTarget !== ''" @click="testConnection('smtp')">
              <LoaderCircle v-if="testingTarget === 'smtp'" class="is-spinning" :size="14" :stroke-width="1.8" aria-hidden="true" />
              <PlugZap v-else :size="14" :stroke-width="1.8" aria-hidden="true" />
              <span>测试 SMTP</span>
            </button>
          </footer>
        </section>
      </div>

      <p v-if="formError" class="mailSettingsError" role="alert">{{ formError }}</p>
      <footer class="mailSettingsFooter">
        <span v-if="config?.updatedAt">更新于 {{ formatDate(config.updatedAt) }}</span>
        <span v-else>尚未保存配置</span>
        <div>
          <button v-if="config?.configured" type="button" :disabled="saving" @click="emit('cancel')">取消</button>
          <button class="is-primary" type="submit" :disabled="saving || testingTarget !== ''">
            <LoaderCircle v-if="saving" class="is-spinning" :size="15" :stroke-width="1.8" aria-hidden="true" />
            <Save v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ saving ? '保存中' : '保存设置' }}</span>
          </button>
        </div>
      </footer>
    </form>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Eye, EyeOff, Inbox, LoaderCircle, LockKeyhole, PlugZap, Save, Send, ShieldCheck } from '@lucide/vue'
import { ApiRequestError, apiRequest } from '../utils/admin-client'

interface MailProtocolConfig {
  host: string
  port: number
  username: string
  passwordConfigured: boolean
}

interface MailConfig {
  configured: boolean
  revision: string | null
  updatedAt: string | null
  address: string
  displayName: string
  imap: MailProtocolConfig
  smtp: MailProtocolConfig
}

interface EditableProtocol extends MailProtocolConfig {
  password: string
  clearPassword: boolean
}

interface ConfigForm {
  address: string
  displayName: string
  imap: EditableProtocol
  smtp: EditableProtocol
}

interface ProtocolPayload {
  host: string
  port: number
  username: string
  password?: string | null
}

type TestTarget = 'imap' | 'smtp'

const props = defineProps<{
  config: MailConfig | null
  accessCode: string
}>()

const emit = defineEmits<{
  saved: [config: MailConfig]
  cancel: []
  notice: [message: string, kind?: 'success' | 'error']
  unauthorized: []
}>()

const form = reactive<ConfigForm>(emptyForm())
const saving = ref(false)
const formError = ref('')
const showImapPassword = ref(false)
const showSmtpPassword = ref(false)
const testingTarget = ref<TestTarget | ''>('')
const testState = reactive<Record<TestTarget, { kind: '' | 'success' | 'error'; message: string }>>({
  imap: { kind: '', message: '' },
  smtp: { kind: '', message: '' },
})

function protocolDefaults(port: number): EditableProtocol {
  return { host: '', port, username: '', passwordConfigured: false, password: '', clearPassword: false }
}

function emptyForm(): ConfigForm {
  return { address: '', displayName: '', imap: protocolDefaults(993), smtp: protocolDefaults(465) }
}

function hydrate(value: MailConfig | null) {
  form.address = value?.address || ''
  form.displayName = value?.displayName || ''
  Object.assign(form.imap, protocolDefaults(993), value?.imap || {}, { port: 993, password: '', clearPassword: false })
  Object.assign(form.smtp, protocolDefaults(465), value?.smtp || {}, { port: 465, password: '', clearPassword: false })
  formError.value = ''
  testState.imap = { kind: '', message: '' }
  testState.smtp = { kind: '', message: '' }
}

function authHeaders() {
  return { 'X-Access-Code': props.accessCode, 'Content-Type': 'application/json' }
}

function passwordState(protocol: EditableProtocol) {
  if (protocol.clearPassword) return '保存后清除密码'
  if (protocol.password) return protocol.passwordConfigured ? '将更新已保存密码' : '将保存新密码'
  return protocol.passwordConfigured ? '密码已保存' : '尚未设置密码'
}

function handleClearPassword(protocol: EditableProtocol) {
  if (protocol.clearPassword) protocol.password = ''
}

function validateProtocol(label: string, protocol: EditableProtocol, allowClear = false) {
  if (!protocol.host.trim()) throw new Error(`请填写 ${label} 服务器`)
  if (!protocol.username.trim()) throw new Error(`请填写 ${label} 用户名`)
  if (protocol.clearPassword && !allowClear) throw new Error(`${label} 密码将被清除，无法测试连接`)
  if (!protocol.clearPassword && !protocol.passwordConfigured && !protocol.password) throw new Error(`请填写 ${label} 密码`)
}

function validateForm() {
  if (!form.address.trim()) throw new Error('请填写邮箱地址')
  if (!/^\S+@\S+\.\S+$/.test(form.address.trim())) throw new Error('邮箱地址格式不正确')
  validateProtocol('IMAP', form.imap, true)
  validateProtocol('SMTP', form.smtp, true)
  if (form.imap.clearPassword !== form.smtp.clearPassword) {
    throw new Error('清除配置时请同时清除 IMAP 和 SMTP 密码')
  }
}

function protocolPayload(protocol: EditableProtocol): ProtocolPayload {
  const result: ProtocolPayload = {
    host: protocol.host.trim(),
    port: protocol.port,
    username: protocol.username.trim(),
  }
  if (protocol.clearPassword) result.password = null
  else if (protocol.password) result.password = protocol.password
  return result
}

function configPayload(includeRevision = true) {
  return {
    ...(includeRevision ? { revision: props.config?.revision ?? null } : {}),
    address: form.address.trim(),
    displayName: form.displayName.trim(),
    imap: protocolPayload(form.imap),
    smtp: protocolPayload(form.smtp),
  }
}

async function testConnection(target: TestTarget) {
  formError.value = ''
  testState[target] = { kind: '', message: '' }
  try {
    if (!form.address.trim()) throw new Error('请填写邮箱地址')
    if (!/^\S+@\S+\.\S+$/.test(form.address.trim())) throw new Error('邮箱地址格式不正确')
    validateProtocol(target.toUpperCase(), form[target])
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '请检查连接设置'
    return
  }
  testingTarget.value = target
  try {
    await apiRequest<{ target: TestTarget; ok: boolean }>('/api/admin/mail/test', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ target, config: configPayload(false) }),
    })
    testState[target] = { kind: 'success', message: '连接成功' }
  } catch (error) {
    testState[target] = { kind: 'error', message: requestError(error, '连接失败') }
  } finally {
    testingTarget.value = ''
  }
}

async function saveConfig() {
  formError.value = ''
  try {
    validateForm()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '请检查邮箱设置'
    return
  }
  saving.value = true
  try {
    const result = await apiRequest<MailConfig>('/api/admin/mail/config', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(configPayload()),
    })
    hydrate(result)
    emit('saved', result)
    emit('notice', '邮箱设置已保存')
  } catch (error) {
    formError.value = requestError(error, '邮箱设置保存失败')
    emit('notice', '邮箱设置保存失败', 'error')
  } finally {
    saving.value = false
  }
}

function requestError(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError && error.status === 401) {
    emit('unauthorized')
    return '管理员会话已失效，请重新登录'
  }
  return error instanceof Error ? error.message : fallback
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

watch(() => props.config, hydrate, { immediate: true })
</script>

<style scoped>
.mailSettings { border-bottom: 1px solid var(--module_dock_border); }
.mailSettingsHeader { min-height: 88px; padding: 18px 2px; border-bottom: 1px solid var(--module_dock_border); display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
.mailSettingsHeader p,
.mailIdentitySettings header p,
.mailProtocolTitle p { margin: 0; font-size: 9px; font-weight: 600; line-height: 13px; opacity: 0.5; }
.mailSettingsHeader h3 { margin: 4px 0 0; font-size: 20px; line-height: 27px; }
.mailSettingsHeader > svg { margin-bottom: 4px; opacity: 0.62; }
.mailIdentitySettings { padding: 22px 2px 26px; border-bottom: 1px solid var(--module_dock_border); }
.mailIdentitySettings h4,
.mailProtocol h4 { margin: 3px 0 0; font-size: 14px; line-height: 20px; }
.mailProtocolGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mailProtocol { min-width: 0; padding: 24px 20px 20px; border-bottom: 1px solid var(--module_dock_border); }
.mailProtocol:first-child { border-right: 1px solid var(--module_dock_border); }
.mailProtocol > header { min-height: 40px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.mailProtocolTitle { min-width: 0; display: flex; align-items: center; gap: 10px; }
.mailProtocolTitle > span { min-width: 0; }
.mailProtocolTitle > svg { opacity: 0.62; }
.mailTlsBadge { min-height: 24px; padding: 0 7px; border: 1px solid rgba(82, 139, 109, 0.38); border-radius: 4px; display: inline-flex; align-items: center; gap: 5px; color: #5a9d76; font-size: 8px; white-space: nowrap; }
.mailFields { margin-top: 18px; display: grid; grid-template-columns: minmax(0, 1fr) 110px; gap: 14px; }
.mailFields.is-identity { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mailField { min-width: 0; display: grid; gap: 7px; }
.mailField.is-wide { grid-column: 1 / -1; }
.mailField > span:first-child { color: var(--weather_dialog_muted); font-size: 9px; line-height: 13px; }
.mailField input { width: 100%; height: 42px; padding: 0 11px; border: 1px solid var(--weather_dialog_line_strong); border-radius: 6px; outline: 0; color: inherit; background: var(--weather_dialog_control_bg); font: inherit; font-size: 11px; user-select: text; }
.mailField input:focus { border-color: var(--weather_dialog_focus); }
.mailField input:disabled { opacity: 0.42; }
.mailField input::placeholder { color: var(--weather_dialog_faint); }
.mailSecretInput { display: grid; grid-template-columns: minmax(0, 1fr) 42px; }
.mailSecretInput input { border-radius: 6px 0 0 6px; }
.mailSecretInput button { width: 42px; height: 42px; padding: 0; border: 1px solid var(--weather_dialog_line_strong); border-left: 0; border-radius: 0 6px 6px 0; display: grid; place-items: center; color: inherit; background: var(--weather_dialog_control_bg); cursor: pointer; }
.mailSecretInput button:hover { background: var(--weather_dialog_control_hover); }
.mailCredentialState { min-height: 18px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.mailCredentialState small { font-size: 8px; opacity: 0.45; }
.mailCredentialState label { display: inline-flex; align-items: center; gap: 5px; font-size: 8px; cursor: pointer; }
.mailCredentialState input { width: 14px; height: 14px; padding: 0; accent-color: var(--weather_dialog_active_bg); }
.mailProtocol > footer { min-height: 52px; margin-top: 17px; border-top: 1px solid var(--module_dock_border); display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.mailProtocol > footer > span { font-size: 8px; opacity: 0.5; }
.mailProtocol > footer > span.success { color: #5a9d76; opacity: 1; }
.mailProtocol > footer > span.error,
.mailSettingsError { color: #c85858; opacity: 1; }
.mailProtocol > footer button,
.mailSettingsFooter button { min-height: 36px; padding: 0 11px; border: 1px solid var(--module_dock_border); border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; color: inherit; background: var(--item_bg_color); font: inherit; font-size: 10px; cursor: pointer; }
.mailProtocol > footer button:hover,
.mailSettingsFooter button:hover { border-color: var(--module_dock_active_border); background: var(--item_hover_color); }
.mailProtocol > footer button:disabled,
.mailSettingsFooter button:disabled { opacity: 0.35; pointer-events: none; }
.mailSettingsError { margin: 14px 2px 0; padding: 10px 12px; border: 1px solid rgba(193, 78, 78, 0.26); border-radius: 6px; background: rgba(193, 78, 78, 0.07); font-size: 9px; }
.mailSettingsFooter { min-height: 76px; padding: 14px 2px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.mailSettingsFooter > span { font-size: 8px; opacity: 0.44; }
.mailSettingsFooter > div { display: flex; align-items: center; gap: 7px; }
.mailSettingsFooter button.is-primary { border-color: var(--weather_dialog_active_bg); color: var(--weather_dialog_active_text); background: var(--weather_dialog_active_bg); }
.is-spinning { animation: mailSettingsSpin 0.8s linear infinite; }
@keyframes mailSettingsSpin { to { transform: rotate(360deg); } }

@media (max-width: 800px) {
  .mailProtocol { padding-inline: 14px; }
}

@media (max-width: 680px) {
  .mailProtocolGrid,
  .mailFields.is-identity { grid-template-columns: 1fr; }
  .mailProtocol:first-child { border-right: 0; }
}

@media (max-width: 640px) {
  .mailIdentitySettings { padding-inline: 0; }
  .mailProtocol { padding-inline: 0; }
  .mailProtocol > header { align-items: flex-start; }
  .mailFields { grid-template-columns: 1fr; }
  .mailField.is-wide { grid-column: auto; }
  .mailCredentialState { align-items: flex-start; flex-direction: column; }
  .mailProtocol > footer { align-items: flex-start; flex-direction: column; padding-top: 12px; }
  .mailProtocol > footer button { width: 100%; }
  .mailSettingsFooter { align-items: stretch; flex-direction: column; }
  .mailSettingsFooter > div { width: 100%; }
  .mailSettingsFooter button { flex: 1 1 0; }
}

@media (prefers-reduced-motion: reduce) {
  .is-spinning { animation: none; }
}
</style>
