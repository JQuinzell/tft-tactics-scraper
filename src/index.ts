import { writeFileSync } from 'fs'
import { chromium, devices } from 'playwright'

interface Stats {
  attackSpeed: number
  damage: number
  range: number
  health: number
  mana: number
  armor: number
  mr: number
}

interface Champion {
  name: string
  class: string[]
  origin: string[]
  rank: Record<1 | 2 | 3, Stats>
}

;(async () => {
  // Setup
  const browser = await chromium.launch()
  const context = await browser.newContext(devices['Desktop Chrome'])
  const page = await context.newPage()

  function getRows() {
    return page.locator('.rt-tbody').first().locator('.rt-tr').all()
  }

  async function getCells() {
    console.log('Getting table data')
    console.time()
    const rows = await getRows()
    const cells = await Promise.all(
      rows.map((cell) => cell.locator('.rt-td').allInnerTexts())
    )
    console.timeEnd()
    return cells
  }

  async function forEachRank(cb: (rank: number) => Promise<void>) {
    await page.locator('img[rank="1"]').click()
    console.log('Rank 1')
    await cb(1)
    await page.locator('img[rank="2"]').click()
    console.log('Rank 2')
    await cb(2)
    await page.locator('img[rank="3"]').click()
    console.log('Rank 3')
    await cb(3)
  }

  await page.goto('https://tftactics.gg/db/origins')
  console.log('getting origins')
  const origins = (await getCells()).map((cell) => cell[0])

  await page.getByRole('link').getByText('Classes').click()
  console.log('getting classes')
  const classes = (await getCells()).map((cell) => cell[0])

  // The actual interesting bit
  // await context.route('**.jpg', (route) => route.abort())
  await page
    .locator('.sidenav')
    .getByRole('link')
    .getByText('Champions')
    .click()
  console.log('getting champions')
  const championMap: Record<string, Partial<Champion>> = {}

  ;(await getCells()).forEach((row) => {
    const [name, origin, unitClasses, cost] = row
    const champion = {
      name,
      origin: origins.filter((o) => origin.includes(o)),
      class: classes.filter((c) => unitClasses.includes(c)),
      cost: parseInt(cost),
      rank: {} as Champion['rank'],
    }
    championMap[name] = champion
  })

  await page.getByRole('link').getByText('Champion Stats').click()
  console.log('getting offense stats')
  await forEachRank(async (rank) => {
    ;(await getCells()).forEach((row) => {
      const [name, dps, attackSpeed, damage, range] = row
      const stats = {
        dps: parseFloat(dps),
        attackSpeed: parseFloat(attackSpeed),
        damage: parseFloat(damage),
        range: parseInt(range),
      }
      console.log(stats, rank)
      championMap[name].rank[rank] = stats
    })
  })
  await page.locator('.main-filters').getByText('Defense').click()
  console.log('getting defense stats')
  await forEachRank(async (rank) => {
    ;(await getCells()).forEach((row) => {
      const [name, health, mana, armor, mr] = row
      championMap[name].rank[rank].health = parseFloat(health)
      championMap[name].rank[rank].mana = parseFloat(mana)
      championMap[name].rank[rank].armor = parseFloat(armor)
      championMap[name].rank[rank].mr = parseInt(mr)
    })
  })
  writeFileSync(
    'data.json',
    JSON.stringify({ origins, classes, champions: championMap }, null, 4)
  )
  // Teardown
  await context.close()
  await browser.close()
})()
