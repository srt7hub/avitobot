import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSystemPrompt } from './aiService.js'

const property = {
  name: 'Студия на Ленина',
  address: 'ул. Ленина, 1',
  description: 'Уютная студия',
  doorCode: '4242',
  wifiName: 'HomeNet',
  wifiPassword: 'secretpass',
  checkInInstructions: 'Ключи в сейфе',
}

function build(phase: Parameters<typeof buildSystemPrompt>[0]['phase']) {
  return buildSystemPrompt({
    botName: 'Аня',
    property,
    faqEntries: [],
    memorySummary: '',
    phase,
  })
}

test('код двери и wifi СКРЫТЫ до оплаты (AWAITING_PAYMENT)', () => {
  const prompt = build('AWAITING_PAYMENT')
  assert.ok(!prompt.includes('4242'), 'код двери не должен попадать в промпт')
  assert.ok(!prompt.includes('secretpass'), 'пароль wifi не должен попадать в промпт')
  assert.ok(!prompt.includes('Ключи в сейфе'), 'инструкция не должна попадать в промпт')
})

test('код двери и wifi СКРЫТЫ до заезда (PAID_BEFORE)', () => {
  const prompt = build('PAID_BEFORE')
  assert.ok(!prompt.includes('4242'))
  assert.ok(!prompt.includes('secretpass'))
})

test('код двери и wifi ВИДНЫ в день заезда (CHECK_IN_DAY)', () => {
  const prompt = build('CHECK_IN_DAY')
  assert.ok(prompt.includes('4242'), 'код двери должен быть в промпте')
  assert.ok(prompt.includes('secretpass'), 'пароль wifi должен быть в промпте')
  assert.ok(prompt.includes('Ключи в сейфе'), 'инструкция должна быть в промпте')
})

test('код двери и wifi ВИДНЫ во время проживания (STAYING)', () => {
  const prompt = build('STAYING')
  assert.ok(prompt.includes('4242'))
  assert.ok(prompt.includes('HomeNet'))
})

test('код двери СКРЫТ после выезда (POST_STAY_ACTIVE)', () => {
  const prompt = build('POST_STAY_ACTIVE')
  assert.ok(!prompt.includes('4242'), 'после выезда код двери выдавать нельзя')
})

test('без брони (NO_BOOKING) чувствительные данные скрыты', () => {
  const prompt = build('NO_BOOKING')
  assert.ok(!prompt.includes('4242'))
  assert.ok(!prompt.includes('secretpass'))
})

test('базовый контекст объекта присутствует всегда', () => {
  const prompt = build('AWAITING_PAYMENT')
  assert.ok(prompt.includes('Студия на Ленина'))
  assert.ok(prompt.includes('Аня'))
})
