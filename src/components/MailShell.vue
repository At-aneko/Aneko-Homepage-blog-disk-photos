<template>
  <section class="mailPage" aria-labelledby="mail-page-title">
    <header class="mailToolbar">
      <div>
        <p>MAIL SERVICE</p>
        <h2 id="mail-page-title">邮箱服务</h2>
      </div>

      <div class="mailCommands">
        <button
          type="button"
          title="刷新邮箱配置"
          :disabled="isRefreshing"
          @click="refreshAll"
        >
          <RefreshCw :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>刷新</span>
        </button>
        <button
          type="button"
          class="mailAuthButton"
          :class="{ 'is-authenticated': isAuthenticated }"
          :title="isAuthenticated ? '退出管理员' : '管理员登录'"
          @click="isAuthenticated ? logout() : showLogin = true"
        >
          <LogOut v-if="isAuthenticated" :size="15" :stroke-width="1.8" aria-hidden="true" />
          <LogIn v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ isAuthenticated ? '已登录' : '登录' }}</span>
        </button>
      </div>
    </header>

    <div v-if="notice" class="mailNotice" :class="`is-${noticeKind}`" role="status">
      <CircleCheck v-if="noticeKind === 'success'" :size="16" :stroke-width="1.8" aria-hidden="true" />
      <CircleAlert v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
      <span>{{ notice }}</span>
    </div>

    <div v-if="publicStatus === 'loading'" class="mailPublicSkeleton" aria-label="正在读取邮箱服务">
      <span></span>
      <span></span>
    </div>

    <div v-else-if="publicStatus === 'error'" class="mailState" role="alert">
      <CircleAlert :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>邮箱服务读取失败</h3>
      <p>{{ publicError }}</p>
      <button type="button" @click="loadPublicConfig">重新载入</button>
    </div>

    <section v-else class="mailPublic" aria-labelledby="mail-public-title">
      <div class="mailIdentity">
        <div class="mailAvailability" :class="{ 'is-enabled': publicConfig.public.enabled }">
          <span></span>
          {{ !publicConfig.configured ? '邮箱服务尚未配置' : publicConfig.public.enabled ? '邮箱服务已公开' : '邮箱服务暂未公开' }}
        </div>
        <h3 id="mail-public-title">{{ publicConfig.public.displayName || 'Aneko Mail' }}</h3>
        <p v-if="publicConfig.public.description">{{ publicConfig.public.description }}</p>
        <p v-else>邮件连接与自动通知服务。</p>

        <a v-if="publishedAddress" class="mailAddress" :href="mailtoHref">
          <Mail :size="17" :stroke-width="1.7" aria-hidden="true" />
          <span>{{ publishedAddress }}</span>
        </a>

        <div v-if="publishedAddress || publicWebmailUrl" class="mailPublicActions">
          <a v-if="publishedAddress" :href="mailtoHref">
            <Send :size="15" :stroke-width="1.8" aria-hidden="true" />
            <span>写邮件</span>
          </a>
          <button v-if="publishedAddress" type="button" title="复制邮箱地址" @click="copyAddress">
            <Copy :size="15" :stroke-width="1.8" aria-hidden="true" />
            <span>复制地址</span>
          </button>
          <a v-if="publicWebmailUrl" :href="publicWebmailUrl" target="_blank" rel="noreferrer">
            <ExternalLink :size="15" :stroke-width="1.8" aria-hidden="true" />
            <span>Webmail</span>
          </a>
        </div>

        <small>{{ publicConfig.updatedAt ? `更新于 ${formatDate(publicConfig.updatedAt)}` : '尚未保存邮箱配置' }}</small>
      </div>

      <div class="mailServiceStatus" aria-label="邮箱连接状态">
        <div class="mailStatusItem">
          <Inbox :size="19" :stroke-width="1.7" aria-hidden="true" />
          <span><strong>IMAP</strong><small>邮件同步</small></span>
          <b :class="{ 'is-enabled': publicConfig.imap.enabled }">
            {{ publicConfig.imap.enabled ? '已配置' : '未配置' }}
          </b>
        </div>
        <div class="mailStatusItem">
          <Archive :size="19" :stroke-width="1.7" aria-hidden="true" />
          <span><strong>POP3</strong><small>邮件下载</small></span>
          <b :class="{ 'is-enabled': publicConfig.pop3.enabled }">
            {{ publicConfig.pop3.enabled ? '已配置' : '未配置' }}
          </b>
        </div>
        <div class="mailStatusItem">
          <Send :size="19" :stroke-width="1.7" aria-hidden="true" />
          <span><strong>SMTP</strong><small>邮件发送</small></span>
          <b :class="{ 'is-enabled': publicConfig.smtp.enabled }">
            {{ publicConfig.smtp.enabled ? '已配置' : '未配置' }}
          </b>
        </div>
        <div class="mailStatusItem">
          <Webhook :size="19" :stroke-width="1.7" aria-hidden="true" />
          <span><strong>Webhook</strong><small>事件通知</small></span>
          <b :class="{ 'is-enabled': publicConfig.webhook.enabled }">
            {{ publicConfig.webhook.enabled ? '已配置' : '未配置' }}
          </b>
        </div>
      </div>
    </section>

    <section class="mailAdmin" aria-labelledby="mail-admin-title">
      <header class="mailAdminHeader">
        <div>
          <p>ADMIN SETTINGS</p>
          <h3 id="mail-admin-title">连接配置</h3>
        </div>
        <ShieldCheck v-if="isAuthenticated" :size="20" :stroke-width="1.7" aria-label="管理员已登录" />
      </header>

      <div v-if="authChecking || adminStatus === 'loading'" class="mailAdminSkeleton" aria-label="正在读取管理员配置">
        <span v-for="index in 6" :key="index"></span>
      </div>

      <div v-else-if="!isAuthenticated" class="mailState is-compact">
        <LockKeyhole :size="30" :stroke-width="1.5" aria-hidden="true" />
        <h3>管理员登录</h3>
        <p>登录后可以配置邮件连接和 Webhook。</p>
        <button type="button" @click="showLogin = true">登录</button>
      </div>

      <div v-else-if="adminStatus === 'error'" class="mailState is-compact" role="alert">
        <CircleAlert :size="30" :stroke-width="1.5" aria-hidden="true" />
        <h3>管理员配置读取失败</h3>
        <p>{{ adminError }}</p>
        <button type="button" @click="loadAdminConfig">重新载入</button>
      </div>

      <form v-else class="mailSettingsForm" @submit.prevent="saveConfig">
        <section class="mailPublicSettings" aria-labelledby="mail-public-settings-title">
          <header class="mailSettingsTitle">
            <div>
              <p>PUBLIC PROFILE</p>
              <h4 id="mail-public-settings-title">公开信息</h4>
            </div>
            <div class="mailTitleToggles">
              <label class="mailSwitch">
                <input v-model="form.public.enabled" type="checkbox" :disabled="saving" />
                <span class="mailSwitchTrack" aria-hidden="true"><span></span></span>
                <span>公开服务</span>
              </label>
              <label class="mailSwitch">
                <input v-model="form.public.publishAddress" type="checkbox" :disabled="saving" />
                <span class="mailSwitchTrack" aria-hidden="true"><span></span></span>
                <span>公开地址</span>
              </label>
            </div>
          </header>

          <div class="mailFieldGrid is-public">
            <label class="mailField">
              <span>显示名称</span>
              <input v-model.trim="form.public.displayName" type="text" autocomplete="off" :disabled="saving" />
            </label>
            <label class="mailField">
              <span>邮箱地址</span>
              <input v-model.trim="form.public.address" type="email" autocomplete="email" :disabled="saving" />
            </label>
            <label class="mailField is-wide">
              <span>简介</span>
              <textarea v-model.trim="form.public.description" rows="3" :disabled="saving"></textarea>
            </label>
            <label class="mailField is-wide">
              <span>Webmail URL</span>
              <input v-model.trim="form.public.webmailUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://mail.example.com" :disabled="saving" />
            </label>
          </div>
        </section>

        <div class="mailServiceGrid">
          <section class="mailServiceSettings" aria-labelledby="mail-imap-title">
            <header class="mailSettingsTitle">
              <div class="mailServiceTitle">
                <Inbox :size="19" :stroke-width="1.7" aria-hidden="true" />
                <span><p>INCOMING MAIL</p><h4 id="mail-imap-title">IMAP</h4></span>
              </div>
              <label class="mailSwitch">
                <input v-model="form.imap.enabled" type="checkbox" :disabled="saving" />
                <span class="mailSwitchTrack" aria-hidden="true"><span></span></span>
                <span>启用</span>
              </label>
            </header>
            <div class="mailFieldGrid">
              <label class="mailField">
                <span>服务器</span>
                <input v-model.trim="form.imap.host" type="text" autocomplete="off" placeholder="imap.example.com" :disabled="saving || !form.imap.enabled" />
              </label>
              <label class="mailField">
                <span>端口</span>
                <input v-model.number="form.imap.port" type="number" min="1" max="65535" inputmode="numeric" :disabled="saving || !form.imap.enabled" />
              </label>
              <label class="mailField">
                <span>安全连接</span>
                <select v-model="form.imap.security" :disabled="saving || !form.imap.enabled">
                  <option value="tls">TLS</option>
                  <option value="starttls">STARTTLS</option>
                </select>
              </label>
              <label class="mailField">
                <span>用户名</span>
                <input v-model.trim="form.imap.username" type="text" autocomplete="username" :disabled="saving || !form.imap.enabled" />
              </label>
              <div class="mailField is-wide">
                <span>密码</span>
                <div class="mailSecretInput">
                  <input
                    v-model="form.imap.password"
                    aria-label="IMAP 密码"
                    :type="showImapPassword ? 'text' : 'password'"
                    autocomplete="new-password"
                    :placeholder="form.imap.passwordConfigured ? '留空保留已保存密码' : '输入密码'"
                    :disabled="saving || !form.imap.enabled || form.imap.clearPassword"
                    @input="form.imap.clearPassword = false"
                  />
                  <button type="button" :title="showImapPassword ? '隐藏密码' : '显示密码'" :disabled="saving || form.imap.clearPassword" @click="showImapPassword = !showImapPassword">
                    <EyeOff v-if="showImapPassword" :size="16" :stroke-width="1.8" aria-hidden="true" />
                    <Eye v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
                  </button>
                </div>
                <div class="mailCredentialMeta">
                  <small>{{ credentialLabel(form.imap) }}</small>
                  <label v-if="form.imap.passwordConfigured" :title="form.imap.enabled ? '停用 IMAP 后可清除密码' : '清除已保存密码'">
                    <input v-model="form.imap.clearPassword" type="checkbox" :disabled="saving || form.imap.enabled" />
                    <span>清除已保存密码</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section class="mailServiceSettings" aria-labelledby="mail-pop3-title">
            <header class="mailSettingsTitle">
              <div class="mailServiceTitle">
                <Archive :size="19" :stroke-width="1.7" aria-hidden="true" />
                <span><p>MAIL DOWNLOAD</p><h4 id="mail-pop3-title">POP3</h4></span>
              </div>
              <label class="mailSwitch">
                <input v-model="form.pop3.enabled" type="checkbox" :disabled="saving" />
                <span class="mailSwitchTrack" aria-hidden="true"><span></span></span>
                <span>启用</span>
              </label>
            </header>
            <div class="mailFieldGrid">
              <label class="mailField">
                <span>服务器</span>
                <input v-model.trim="form.pop3.host" type="text" autocomplete="off" placeholder="pop.example.com" :disabled="saving || !form.pop3.enabled" />
              </label>
              <label class="mailField">
                <span>端口</span>
                <input v-model.number="form.pop3.port" type="number" min="1" max="65535" inputmode="numeric" :disabled="saving || !form.pop3.enabled" />
              </label>
              <label class="mailField">
                <span>安全连接</span>
                <select v-model="form.pop3.security" :disabled="saving || !form.pop3.enabled">
                  <option value="tls">TLS</option>
                  <option value="starttls">STARTTLS</option>
                </select>
              </label>
              <label class="mailField">
                <span>用户名</span>
                <input v-model.trim="form.pop3.username" type="text" autocomplete="username" :disabled="saving || !form.pop3.enabled" />
              </label>
              <div class="mailField is-wide">
                <span>密码</span>
                <div class="mailSecretInput">
                  <input
                    v-model="form.pop3.password"
                    aria-label="POP3 密码"
                    :type="showPop3Password ? 'text' : 'password'"
                    autocomplete="new-password"
                    :placeholder="form.pop3.passwordConfigured ? '留空保留已保存密码' : '输入密码'"
                    :disabled="saving || !form.pop3.enabled || form.pop3.clearPassword"
                    @input="form.pop3.clearPassword = false"
                  />
                  <button type="button" :title="showPop3Password ? '隐藏密码' : '显示密码'" :disabled="saving || form.pop3.clearPassword" @click="showPop3Password = !showPop3Password">
                    <EyeOff v-if="showPop3Password" :size="16" :stroke-width="1.8" aria-hidden="true" />
                    <Eye v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
                  </button>
                </div>
                <div class="mailCredentialMeta">
                  <small>{{ credentialLabel(form.pop3) }}</small>
                  <label v-if="form.pop3.passwordConfigured" :title="form.pop3.enabled ? '停用 POP3 后可清除密码' : '清除已保存密码'">
                    <input v-model="form.pop3.clearPassword" type="checkbox" :disabled="saving || form.pop3.enabled" />
                    <span>清除已保存密码</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section class="mailServiceSettings" aria-labelledby="mail-smtp-title">
            <header class="mailSettingsTitle">
              <div class="mailServiceTitle">
                <Send :size="19" :stroke-width="1.7" aria-hidden="true" />
                <span><p>OUTGOING MAIL</p><h4 id="mail-smtp-title">SMTP</h4></span>
              </div>
              <label class="mailSwitch">
                <input v-model="form.smtp.enabled" type="checkbox" :disabled="saving" />
                <span class="mailSwitchTrack" aria-hidden="true"><span></span></span>
                <span>启用</span>
              </label>
            </header>
            <div class="mailFieldGrid">
              <label class="mailField">
                <span>服务器</span>
                <input v-model.trim="form.smtp.host" type="text" autocomplete="off" placeholder="smtp.example.com" :disabled="saving || !form.smtp.enabled" />
              </label>
              <label class="mailField">
                <span>端口</span>
                <input v-model.number="form.smtp.port" type="number" min="1" max="65535" inputmode="numeric" :disabled="saving || !form.smtp.enabled" />
              </label>
              <label class="mailField">
                <span>安全连接</span>
                <select v-model="form.smtp.security" :disabled="saving || !form.smtp.enabled">
                  <option value="tls">TLS</option>
                  <option value="starttls">STARTTLS</option>
                </select>
              </label>
              <label class="mailField">
                <span>用户名</span>
                <input v-model.trim="form.smtp.username" type="text" autocomplete="username" :disabled="saving || !form.smtp.enabled" />
              </label>
              <div class="mailField is-wide">
                <span>密码</span>
                <div class="mailSecretInput">
                  <input
                    v-model="form.smtp.password"
                    aria-label="SMTP 密码"
                    :type="showSmtpPassword ? 'text' : 'password'"
                    autocomplete="new-password"
                    :placeholder="form.smtp.passwordConfigured ? '留空保留已保存密码' : '输入密码'"
                    :disabled="saving || !form.smtp.enabled || form.smtp.clearPassword"
                    @input="form.smtp.clearPassword = false"
                  />
                  <button type="button" :title="showSmtpPassword ? '隐藏密码' : '显示密码'" :disabled="saving || form.smtp.clearPassword" @click="showSmtpPassword = !showSmtpPassword">
                    <EyeOff v-if="showSmtpPassword" :size="16" :stroke-width="1.8" aria-hidden="true" />
                    <Eye v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
                  </button>
                </div>
                <div class="mailCredentialMeta">
                  <small>{{ credentialLabel(form.smtp) }}</small>
                  <label v-if="form.smtp.passwordConfigured" :title="form.smtp.enabled ? '停用 SMTP 后可清除密码' : '清除已保存密码'">
                    <input v-model="form.smtp.clearPassword" type="checkbox" :disabled="saving || form.smtp.enabled" />
                    <span>清除已保存密码</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section class="mailServiceSettings" aria-labelledby="mail-webhook-title">
            <header class="mailSettingsTitle">
              <div class="mailServiceTitle">
                <Webhook :size="19" :stroke-width="1.7" aria-hidden="true" />
                <span><p>EVENT DELIVERY</p><h4 id="mail-webhook-title">Webhook</h4></span>
              </div>
              <label class="mailSwitch">
                <input v-model="form.webhook.enabled" type="checkbox" :disabled="saving" />
                <span class="mailSwitchTrack" aria-hidden="true"><span></span></span>
                <span>启用</span>
              </label>
            </header>
            <div class="mailFieldGrid">
              <label class="mailField is-wide">
                <span>接收 URL</span>
                <input v-model.trim="form.webhook.url" type="url" inputmode="url" autocomplete="url" placeholder="https://example.com/webhooks/mail" :disabled="saving || !form.webhook.enabled" />
              </label>
              <label class="mailField is-wide">
                <span>认证方式</span>
                <select v-model="form.webhook.authMode" :disabled="saving || !form.webhook.enabled">
                  <option value="bearer">Bearer Token</option>
                  <option value="hmac-sha256">HMAC-SHA256</option>
                </select>
              </label>
              <fieldset class="mailEvents is-wide" :disabled="saving || !form.webhook.enabled">
                <legend>通知事件</legend>
                <div>
                  <label><input v-model="form.webhook.events" type="checkbox" value="incoming" /><span>收到邮件</span></label>
                  <label><input v-model="form.webhook.events" type="checkbox" value="delivery" /><span>投递成功</span></label>
                  <label><input v-model="form.webhook.events" type="checkbox" value="failure" /><span>投递失败</span></label>
                </div>
              </fieldset>
              <div class="mailField is-wide">
                <span>认证密钥</span>
                <div class="mailSecretInput">
                  <input
                    v-model="form.webhook.secret"
                    aria-label="Webhook 认证密钥"
                    :type="showWebhookSecret ? 'text' : 'password'"
                    autocomplete="new-password"
                    :placeholder="form.webhook.secretConfigured ? '留空保留已保存密钥' : '输入密钥'"
                    :disabled="saving || !form.webhook.enabled || form.webhook.clearSecret"
                    @input="form.webhook.clearSecret = false"
                  />
                  <button type="button" :title="showWebhookSecret ? '隐藏密钥' : '显示密钥'" :disabled="saving || form.webhook.clearSecret" @click="showWebhookSecret = !showWebhookSecret">
                    <EyeOff v-if="showWebhookSecret" :size="16" :stroke-width="1.8" aria-hidden="true" />
                    <Eye v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
                  </button>
                </div>
                <div class="mailCredentialMeta">
                  <small>{{ webhookCredentialLabel }}</small>
                  <label v-if="form.webhook.secretConfigured" :title="form.webhook.enabled ? '停用 Webhook 后可清除密钥' : '清除已保存密钥'">
                    <input v-model="form.webhook.clearSecret" type="checkbox" :disabled="saving || form.webhook.enabled" />
                    <span>清除已保存密钥</span>
                  </label>
                </div>
              </div>
              <p class="mailWebhookHint is-wide">保存通知目标和认证信息；当前版本不会主动发送事件或测试请求。</p>
            </div>
          </section>
        </div>

        <p v-if="formError" class="mailFormError" role="alert">{{ formError }}</p>

        <footer class="mailFormFooter">
          <span>{{ publicConfig?.updatedAt ? `当前配置更新于 ${formatDate(publicConfig.updatedAt)}` : '尚未保存配置' }}</span>
          <div>
            <button type="button" :disabled="saving" @click="loadAdminConfig">
              <RefreshCw :size="15" :stroke-width="1.8" aria-hidden="true" />
              <span>重新载入</span>
            </button>
            <button class="is-primary" type="submit" :disabled="saving">
              <Save :size="15" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ saving ? '保存中' : '保存配置' }}</span>
            </button>
          </div>
        </footer>
      </form>
    </section>

    <AdminLoginDialog :open="showLogin" @close="showLogin = false" @authenticated="handleAuthenticated" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Archive,
  CircleAlert,
  CircleCheck,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Inbox,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Webhook,
} from '@lucide/vue'
import AdminLoginDialog from './AdminLoginDialog.vue'
import { apiRequest, clearAdminAccess, restoreAdminAccess } from '../utils/admin-client'

type SecurityMode = 'tls' | 'starttls'
type WebhookEvent = 'incoming' | 'delivery' | 'failure'
type WebhookAuthMode = 'bearer' | 'hmac-sha256'
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface MailPublicProfile {
  enabled: boolean
  publishAddress: boolean
  displayName: string
  address: string
  description: string
  webmailUrl: string
}

interface PublicMailConfig {
  configured: boolean
  revision: string | null
  updatedAt: string | null
  public: MailPublicProfile
  imap: { enabled: boolean }
  pop3: { enabled: boolean }
  smtp: { enabled: boolean }
  webhook: { enabled: boolean }
}

interface AdminProtocolConfig {
  enabled: boolean
  host: string
  port: number
  security: SecurityMode
  username: string
  passwordConfigured: boolean
}

interface AdminWebhookConfig {
  enabled: boolean
  url: string
  events: WebhookEvent[]
  authMode: WebhookAuthMode
  secretConfigured: boolean
}

interface AdminMailConfig {
  configured: boolean
  revision: string | null
  updatedAt: string | null
  public: MailPublicProfile
  imap: AdminProtocolConfig
  pop3: AdminProtocolConfig
  smtp: AdminProtocolConfig
  webhook: AdminWebhookConfig
}

interface EditableProtocol extends AdminProtocolConfig {
  password: string
  clearPassword: boolean
}

interface EditableWebhook extends AdminWebhookConfig {
  secret: string
  clearSecret: boolean
}

interface MailForm {
  public: MailPublicProfile
  imap: EditableProtocol
  pop3: EditableProtocol
  smtp: EditableProtocol
  webhook: EditableWebhook
}

type ProtocolPayload = Omit<AdminProtocolConfig, 'passwordConfigured'> & { password?: string | null }
type WebhookPayload = Omit<AdminWebhookConfig, 'secretConfigured'> & { secret?: string | null }

const publicConfig = ref<PublicMailConfig | null>(null)
const publicStatus = ref<LoadStatus>('loading')
const publicError = ref('')
const adminStatus = ref<LoadStatus>('idle')
const adminError = ref('')
const authChecking = ref(true)
const accessCode = ref('')
const showLogin = ref(false)
const saving = ref(false)
const formError = ref('')
const notice = ref('')
const noticeKind = ref<'success' | 'error'>('success')
const showImapPassword = ref(false)
const showPop3Password = ref(false)
const showSmtpPassword = ref(false)
const showWebhookSecret = ref(false)
const form = ref<MailForm>(createDefaultForm())
const adminRevision = ref<string | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | null = null

const isAuthenticated = computed(() => Boolean(accessCode.value))
const isRefreshing = computed(() => publicStatus.value === 'loading' || adminStatus.value === 'loading' || saving.value)
const publishedAddress = computed(() => {
  const config = publicConfig.value
  if (!config?.public.enabled || !config.public.publishAddress) return ''
  return config.public.address.trim()
})
const mailtoHref = computed(() => publishedAddress.value ? `mailto:${publishedAddress.value}` : '')
const publicWebmailUrl = computed(() => {
  const config = publicConfig.value
  return config?.public.enabled ? config.public.webmailUrl.trim() : ''
})
const webhookCredentialLabel = computed(() => {
  if (form.value.webhook.clearSecret) return '保存后清除密钥'
  if (form.value.webhook.secret) return form.value.webhook.secretConfigured ? '将更新已保存密钥' : '将保存新密钥'
  return form.value.webhook.secretConfigured ? '密钥已保存' : '尚未保存密钥'
})

function createProtocol(port: number, security: SecurityMode): EditableProtocol {
  return {
    enabled: false,
    host: '',
    port,
    security,
    username: '',
    passwordConfigured: false,
    password: '',
    clearPassword: false,
  }
}

function createDefaultForm(): MailForm {
  return {
    public: {
      enabled: false,
      publishAddress: false,
      displayName: '',
      address: '',
      description: '',
      webmailUrl: '',
    },
    imap: createProtocol(993, 'tls'),
    pop3: createProtocol(995, 'tls'),
    smtp: createProtocol(465, 'tls'),
    webhook: {
      enabled: false,
      url: '',
      events: ['incoming'],
      authMode: 'hmac-sha256',
      secretConfigured: false,
      secret: '',
      clearSecret: false,
    },
  }
}

function normalizeProtocol(config: AdminProtocolConfig | undefined, port: number, security: SecurityMode): EditableProtocol {
  const fallback = createProtocol(port, security)
  if (!config) return fallback
  return {
    enabled: Boolean(config.enabled),
    host: config.host || '',
    port: Number(config.port) || port,
    security: config.security === 'starttls' ? 'starttls' : 'tls',
    username: config.username || '',
    passwordConfigured: Boolean(config.passwordConfigured),
    password: '',
    clearPassword: false,
  }
}

function hydrateForm(config: AdminMailConfig) {
  adminRevision.value = config.revision
  const defaults = createDefaultForm()
  form.value = {
    public: { ...defaults.public, ...(config.public || {}) },
    imap: normalizeProtocol(config.imap, 993, 'tls'),
    pop3: normalizeProtocol(config.pop3, 995, 'tls'),
    smtp: normalizeProtocol(config.smtp, 465, 'tls'),
    webhook: {
      ...defaults.webhook,
      ...(config.webhook || {}),
      events: Array.isArray(config.webhook?.events) ? [...config.webhook.events] : ['incoming'],
      secretConfigured: Boolean(config.webhook?.secretConfigured),
      secret: '',
      clearSecret: false,
    },
  }
  showImapPassword.value = false
  showPop3Password.value = false
  showSmtpPassword.value = false
  showWebhookSecret.value = false
}

function authHeaders(contentType?: string) {
  return {
    'X-Access-Code': accessCode.value,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  }
}

async function loadPublicConfig() {
  publicStatus.value = 'loading'
  publicError.value = ''
  try {
    publicConfig.value = await apiRequest<PublicMailConfig>('/api/mail/config', { cache: 'no-store' })
    publicStatus.value = 'ready'
  } catch (error) {
    publicStatus.value = 'error'
    publicError.value = error instanceof Error ? error.message : '无法读取邮箱服务'
  }
}

async function loadAdminConfig() {
  if (!accessCode.value) return
  adminStatus.value = 'loading'
  adminError.value = ''
  formError.value = ''
  try {
    const config = await apiRequest<AdminMailConfig>('/api/admin/mail/config', {
      headers: authHeaders(),
      cache: 'no-store',
    })
    hydrateForm(config)
    adminStatus.value = 'ready'
  } catch (error) {
    adminStatus.value = 'error'
    adminError.value = error instanceof Error ? error.message : '无法读取管理员配置'
  }
}

async function refreshAll() {
  const tasks: Promise<void>[] = [loadPublicConfig()]
  if (isAuthenticated.value) tasks.push(loadAdminConfig())
  await Promise.all(tasks)
}

function handleAuthenticated(code: string) {
  accessCode.value = code
  showLogin.value = false
  showNotice('管理员登录成功')
  void loadAdminConfig()
}

function logout() {
  clearAdminAccess()
  accessCode.value = ''
  adminStatus.value = 'idle'
  adminError.value = ''
  formError.value = ''
  form.value = createDefaultForm()
  adminRevision.value = null
  showNotice('已退出管理员')
}

function showNotice(message: string, kind: 'success' | 'error' = 'success') {
  if (noticeTimer) clearTimeout(noticeTimer)
  notice.value = message
  noticeKind.value = kind
  noticeTimer = setTimeout(() => {
    notice.value = ''
    noticeTimer = null
  }, 3200)
}

async function copyAddress() {
  if (!publishedAddress.value) return
  try {
    await navigator.clipboard.writeText(publishedAddress.value)
    showNotice('邮箱地址已复制')
  } catch {
    showNotice('复制失败，请手动复制', 'error')
  }
}

function credentialLabel(protocol: EditableProtocol) {
  if (protocol.clearPassword) return '保存后清除密码'
  if (protocol.password) return protocol.passwordConfigured ? '将更新已保存密码' : '将保存新密码'
  return protocol.passwordConfigured ? '密码已保存' : '尚未保存密码'
}

function validatePort(label: string, port: number) {
  const value = Number(port)
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${label} 端口必须在 1 到 65535 之间`)
}

function validateProtocol(label: string, protocol: EditableProtocol) {
  validatePort(label, protocol.port)
  if (label === 'SMTP' && Number(protocol.port) === 25) throw new Error('Cloudflare Workers 不支持 SMTP 25 端口')
  if (!protocol.enabled) return
  if (!protocol.host.trim()) throw new Error(`请填写 ${label} 服务器`)
  if (!protocol.username.trim()) throw new Error(`请填写 ${label} 用户名`)
  if (protocol.clearPassword) throw new Error(`请先停用 ${label}，再清除已保存密码`)
  if (!protocol.clearPassword && !protocol.passwordConfigured && !protocol.password) throw new Error(`请填写 ${label} 密码`)
}

function validateHttpsUrl(value: string, label: string) {
  if (!value) return
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} 格式不正确`)
  }
  if (url.protocol !== 'https:') throw new Error(`${label} 必须使用 HTTPS`)
}

function validateForm() {
  if (!form.value.public.displayName.trim()) {
    throw new Error('公开显示名称不能为空')
  }
  if (form.value.public.publishAddress && !form.value.public.address.trim()) {
    throw new Error('公开邮箱地址不能为空')
  }
  validateHttpsUrl(form.value.public.webmailUrl.trim(), 'Webmail URL')
  validateProtocol('IMAP', form.value.imap)
  validateProtocol('POP3', form.value.pop3)
  validateProtocol('SMTP', form.value.smtp)

  const webhook = form.value.webhook
  if (!webhook.enabled) return
  if (!webhook.url.trim()) throw new Error('请填写 Webhook 接收 URL')
  validateHttpsUrl(webhook.url.trim(), 'Webhook URL')
  if (webhook.events.length === 0) throw new Error('请至少选择一个 Webhook 通知事件')
  if (webhook.clearSecret) throw new Error('请先停用 Webhook，再清除已保存密钥')
  if (!webhook.clearSecret && !webhook.secretConfigured && !webhook.secret) throw new Error('请填写 Webhook 签名密钥')
}

function protocolPayload(protocol: EditableProtocol): ProtocolPayload {
  const payload: ProtocolPayload = {
    enabled: protocol.enabled,
    host: protocol.host.trim(),
    port: Number(protocol.port),
    security: protocol.security,
    username: protocol.username.trim(),
  }
  if (protocol.clearPassword) payload.password = null
  else if (protocol.password) payload.password = protocol.password
  return payload
}

function webhookPayload(webhook: EditableWebhook): WebhookPayload {
  const payload: WebhookPayload = {
    enabled: webhook.enabled,
    url: webhook.url.trim(),
    events: [...webhook.events],
    authMode: webhook.authMode,
  }
  if (webhook.clearSecret) payload.secret = null
  else if (webhook.secret) payload.secret = webhook.secret
  return payload
}

async function saveConfig() {
  formError.value = ''
  try {
    validateForm()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '请检查配置内容'
    return
  }

  saving.value = true
  try {
    const config = await apiRequest<AdminMailConfig>('/api/admin/mail/config', {
      method: 'PUT',
      headers: authHeaders('application/json'),
      body: JSON.stringify({
        revision: adminRevision.value,
        public: {
          enabled: form.value.public.enabled,
          publishAddress: form.value.public.publishAddress,
          displayName: form.value.public.displayName.trim(),
          address: form.value.public.address.trim(),
          description: form.value.public.description.trim(),
          webmailUrl: form.value.public.webmailUrl.trim(),
        },
        imap: protocolPayload(form.value.imap),
        pop3: protocolPayload(form.value.pop3),
        smtp: protocolPayload(form.value.smtp),
        webhook: webhookPayload(form.value.webhook),
      }),
    })
    hydrateForm(config)
    adminStatus.value = 'ready'
    showNotice('邮箱配置已保存')
    void loadPublicConfig()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '邮箱配置保存失败'
    showNotice('邮箱配置保存失败', 'error')
  } finally {
    saving.value = false
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

onMounted(async () => {
  const publicRequest = loadPublicConfig()
  accessCode.value = await restoreAdminAccess()
  authChecking.value = false
  if (accessCode.value) await loadAdminConfig()
  await publicRequest
})

onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
})
</script>

<style scoped>
.mailPage {
  width: calc(100% - 14px);
  margin: 0 7px;
  padding: 24px 0 76px;
}

.mailToolbar {
  min-height: 112px;
  padding: 24px 2px 18px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 22px;
}

.mailToolbar > div:first-child > p,
.mailAdminHeader p,
.mailSettingsTitle p {
  margin: 0;
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
  opacity: 0.5;
}

.mailToolbar h2 {
  margin: 5px 0 0;
  font-size: 25px;
  font-weight: 600;
  line-height: 32px;
}

.mailCommands,
.mailPublicActions,
.mailFormFooter > div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.mailCommands { justify-content: flex-end; }

.mailCommands button,
.mailPublicActions button,
.mailPublicActions a,
.mailState button,
.mailFormFooter button {
  min-height: 36px;
  padding: 0 11px;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: inherit;
  background: var(--item_bg_color);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}

.mailCommands button:hover,
.mailPublicActions button:hover,
.mailPublicActions a:hover,
.mailState button:hover,
.mailFormFooter button:hover {
  border-color: var(--module_dock_active_border);
  background: var(--item_hover_color);
  transform: translateY(-1px);
}

.mailCommands button:active,
.mailPublicActions button:active,
.mailPublicActions a:active,
.mailState button:active,
.mailFormFooter button:active { transform: scale(0.97); }

.mailCommands button:disabled,
.mailFormFooter button:disabled { opacity: 0.35; pointer-events: none; }
.mailAuthButton.is-authenticated { border-color: rgba(90, 160, 118, 0.4); }

.mailNotice {
  min-height: 42px;
  margin-top: 10px;
  padding: 0 12px;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--item_bg_color);
  font-size: 10px;
}

.mailNotice.is-error,
.mailFormError { color: #ffb4b4; }

.mailPublicSkeleton {
  min-height: 310px;
  padding: 28px 2px;
  border-bottom: 1px solid var(--module_dock_border);
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: 34px;
}

.mailPublicSkeleton span,
.mailAdminSkeleton span {
  display: block;
  background: linear-gradient(100deg, transparent 20%, var(--item_bg_color) 45%, transparent 70%);
  background-size: 220% 100%;
  animation: mailShimmer 1.35s ease-in-out infinite;
}

.mailPublicSkeleton span { min-height: 250px; }

.mailPublic {
  min-height: 310px;
  padding: 28px 2px;
  border-bottom: 1px solid var(--module_dock_border);
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  align-items: stretch;
  gap: 34px;
}

.mailIdentity {
  min-width: 0;
  padding: 18px 4px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.mailAvailability {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 9px;
  line-height: 14px;
  opacity: 0.62;
}

.mailAvailability > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9a6c6c;
}

.mailAvailability.is-enabled > span { background: #62ae7d; }
.mailIdentity h3 { margin: 15px 0 0; font-size: 29px; line-height: 37px; overflow-wrap: anywhere; }
.mailIdentity > p { max-width: 620px; margin: 8px 0 0; font-size: 11px; line-height: 19px; opacity: 0.64; }
.mailIdentity > small { margin-top: auto; padding-top: 22px; font-size: 8px; opacity: 0.42; }

.mailAddress {
  max-width: 100%;
  margin-top: 22px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  line-height: 21px;
}

.mailAddress span { min-width: 0; overflow-wrap: anywhere; user-select: text; }
.mailPublicActions { margin-top: 14px; }

.mailServiceStatus {
  border-top: 1px solid var(--module_dock_border);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-self: center;
}

.mailStatusItem {
  min-width: 0;
  min-height: 92px;
  padding: 16px;
  border-bottom: 1px solid var(--module_dock_border);
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.mailStatusItem:nth-child(odd) { border-right: 1px solid var(--module_dock_border); }
.mailStatusItem > svg { opacity: 0.64; }
.mailStatusItem > span { min-width: 0; display: grid; gap: 3px; }
.mailStatusItem strong { font-size: 11px; line-height: 16px; }
.mailStatusItem small { font-size: 8px; line-height: 12px; opacity: 0.45; }
.mailStatusItem b { font-size: 8px; font-weight: 500; opacity: 0.38; }
.mailStatusItem b.is-enabled { color: #b7efc9; opacity: 0.86; }

.mailAdmin { margin-top: 30px; }
.mailAdminHeader {
  min-height: 70px;
  padding: 12px 2px 16px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}
.mailAdminHeader h3 { margin: 4px 0 0; font-size: 20px; line-height: 27px; }
.mailAdminHeader > svg { margin-bottom: 4px; opacity: 0.7; }

.mailAdminSkeleton {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.mailAdminSkeleton span { min-height: 260px; border-bottom: 1px solid var(--module_dock_border); }
.mailAdminSkeleton span:nth-child(odd) { border-right: 1px solid var(--module_dock_border); }

.mailState {
  min-height: 310px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.mailState.is-compact { min-height: 280px; }
.mailState h3 { margin: 14px 0 0; font-size: 18px; line-height: 25px; }
.mailState p { max-width: 520px; margin: 6px 18px 0; font-size: 10px; line-height: 17px; opacity: 0.54; }
.mailState button { margin-top: 18px; }

.mailSettingsForm { border-bottom: 1px solid var(--module_dock_border); }
.mailPublicSettings { padding: 24px 2px 28px; border-bottom: 1px solid var(--module_dock_border); }
.mailSettingsTitle {
  min-height: 42px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.mailSettingsTitle h4 { margin: 3px 0 0; font-size: 15px; line-height: 21px; }
.mailTitleToggles { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 14px; }
.mailServiceTitle { min-width: 0; display: flex; align-items: center; gap: 10px; }
.mailServiceTitle > svg { flex: 0 0 auto; opacity: 0.64; }
.mailServiceTitle > span { min-width: 0; }

.mailSwitch {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 9px;
  line-height: 14px;
  cursor: pointer;
}
.mailSwitch input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.mailSwitchTrack {
  position: relative;
  width: 31px;
  height: 18px;
  border: 1px solid var(--module_dock_border);
  border-radius: 9px;
  display: block;
  background: var(--module_dock_inactive_bg);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.mailSwitchTrack > span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.55;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.mailSwitch input:checked + .mailSwitchTrack { border-color: rgba(90, 160, 118, 0.55); background: rgba(90, 160, 118, 0.2); }
.mailSwitch input:checked + .mailSwitchTrack > span { opacity: 0.9; transform: translateX(13px); }
.mailSwitch input:focus-visible + .mailSwitchTrack { outline: 2px solid currentColor; outline-offset: 2px; }
.mailSwitch input:disabled ~ span { opacity: 0.35; cursor: default; }

.mailServiceGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mailServiceSettings { min-width: 0; padding: 24px 20px 28px; border-bottom: 1px solid var(--module_dock_border); }
.mailServiceSettings:nth-child(odd) { border-right: 1px solid var(--module_dock_border); }

.mailFieldGrid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(112px, 0.42fr);
  gap: 14px;
}
.mailFieldGrid.is-public { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mailField,
.mailEvents { min-width: 0; }
.mailField { display: grid; gap: 7px; }
.mailField.is-wide,
.mailEvents.is-wide,
.mailWebhookHint.is-wide { grid-column: 1 / -1; }
.mailField > span,
.mailEvents legend {
  color: var(--weather_dialog_muted);
  font-size: 9px;
  line-height: 13px;
}

.mailField input,
.mailField select,
.mailField textarea {
  width: 100%;
  border: 1px solid var(--weather_dialog_line_strong);
  border-radius: 6px;
  outline: 0;
  color: inherit;
  background: var(--weather_dialog_control_bg);
  font: inherit;
  font-size: 11px;
  user-select: text;
}
.mailField input,
.mailField select { height: 42px; padding: 0 11px; }
.mailField select { appearance: auto; }
.mailField textarea { min-height: 82px; padding: 11px; resize: vertical; line-height: 18px; }
.mailField input:focus,
.mailField select:focus,
.mailField textarea:focus { border-color: var(--weather_dialog_focus); }
.mailField input:disabled,
.mailField select:disabled,
.mailField textarea:disabled { opacity: 0.42; }
.mailField input::placeholder { color: var(--weather_dialog_faint); }

.mailSecretInput { display: grid; grid-template-columns: minmax(0, 1fr) 42px; }
.mailSecretInput input { border-radius: 6px 0 0 6px; }
.mailSecretInput button {
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid var(--weather_dialog_line_strong);
  border-left: 0;
  border-radius: 0 6px 6px 0;
  display: grid;
  place-items: center;
  color: inherit;
  background: var(--weather_dialog_control_bg);
  cursor: pointer;
}
.mailSecretInput button:hover { background: var(--weather_dialog_control_hover); }
.mailSecretInput button:disabled { opacity: 0.35; pointer-events: none; }
.mailCredentialMeta {
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.mailCredentialMeta small { font-size: 8px; opacity: 0.45; }
.mailCredentialMeta label,
.mailEvents label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 8px;
  cursor: pointer;
}
.mailCredentialMeta input,
.mailEvents input { width: 14px; height: 14px; accent-color: var(--weather_dialog_active_bg); }

.mailEvents { margin: 0; padding: 0; border: 0; }
.mailEvents legend { margin-bottom: 8px; }
.mailEvents > div { display: flex; flex-wrap: wrap; gap: 12px; }
.mailEvents:disabled { opacity: 0.42; }
.mailWebhookHint { margin: -2px 0 0; font-size: 8px; line-height: 14px; opacity: 0.45; }

.mailFormError {
  margin: 14px 2px 0;
  padding: 10px 12px;
  border: 1px solid rgba(193, 78, 78, 0.25);
  border-radius: 6px;
  background: rgba(193, 78, 78, 0.08);
  font-size: 10px;
  line-height: 16px;
}

.mailFormFooter {
  min-height: 74px;
  padding: 14px 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}
.mailFormFooter > span { font-size: 8px; line-height: 14px; opacity: 0.45; }
.mailFormFooter button.is-primary {
  border-color: var(--weather_dialog_active_bg);
  color: var(--weather_dialog_active_text);
  background: var(--weather_dialog_active_bg);
}

@keyframes mailShimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }

@media (max-width: 900px) {
  .mailPublic,
  .mailPublicSkeleton { grid-template-columns: 1fr; gap: 10px; }
  .mailPublicSkeleton span { min-height: 150px; }
  .mailIdentity { min-height: 240px; }
}

@media (max-width: 800px) {
  .mailPage { width: calc(100% - 18px); margin: 0 9px; }
  .mailServiceSettings { padding-inline: 14px; }
}

@media (max-width: 680px) {
  .mailServiceGrid,
  .mailAdminSkeleton { grid-template-columns: 1fr; }
  .mailServiceSettings:nth-child(odd),
  .mailAdminSkeleton span:nth-child(odd) { border-right: 0; }
}

@media (max-width: 640px) {
  .mailToolbar { align-items: flex-start; flex-direction: column; }
  .mailCommands { width: 100%; justify-content: flex-start; }
  .mailCommands .mailAuthButton { margin-left: auto; }
  .mailCommands button { width: 36px; padding: 0; }
  .mailCommands button span { display: none; }
  .mailPublic { padding-top: 18px; }
  .mailIdentity h3 { font-size: 24px; line-height: 32px; }
  .mailServiceStatus { grid-template-columns: 1fr; }
  .mailStatusItem:nth-child(odd) { border-right: 0; }
  .mailSettingsTitle { align-items: flex-start; flex-direction: column; }
  .mailTitleToggles { width: 100%; justify-content: flex-start; }
  .mailFieldGrid,
  .mailFieldGrid.is-public { grid-template-columns: 1fr; }
  .mailField.is-wide,
  .mailEvents.is-wide,
  .mailWebhookHint.is-wide { grid-column: auto; }
  .mailPublicSettings { padding-inline: 0; }
  .mailServiceSettings { padding-inline: 0; }
  .mailCredentialMeta { align-items: flex-start; flex-direction: column; gap: 7px; }
  .mailFormFooter { align-items: stretch; flex-direction: column; }
  .mailFormFooter > div { width: 100%; }
  .mailFormFooter button { flex: 1 1 0; }
}

@media (prefers-reduced-motion: reduce) {
  .mailPublicSkeleton span,
  .mailAdminSkeleton span { animation: none; }
  .mailCommands button,
  .mailPublicActions button,
  .mailPublicActions a,
  .mailState button,
  .mailFormFooter button,
  .mailSwitchTrack,
  .mailSwitchTrack > span { transition: none; }
}
</style>
