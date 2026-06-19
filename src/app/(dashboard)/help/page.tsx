'use client'

import { useState } from 'react'
import {
  BookOpen, ShoppingCart, Truck, Package, Users, CreditCard,
  RotateCcw, BarChart2, Settings, ChevronDown, ChevronUp,
  ClipboardList, MapPin, AlertTriangle, CheckCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

type Role = 'ADMIN' | 'AGJENT' | 'SHOFER' | 'DEPOIST'

interface Section {
  id: string
  title: string
  icon: React.ReactNode
  content: React.ReactNode
}

function Accordion({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left bg-white hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className="text-primary">{icon}</span>
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 bg-white border-t border-gray-50 text-sm text-gray-600 space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
      <p>{text}</p>
    </div>
  )
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
      <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
      <p className="text-blue-800 text-xs">{text}</p>
    </div>
  )
}

function Warn({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-amber-800 text-xs">{text}</p>
    </div>
  )
}

const ROLES: { id: Role; label: string; color: string }[] = [
  { id: 'ADMIN',   label: 'Admin',   color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'AGJENT',  label: 'Agjent',  color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'SHOFER',  label: 'Shofer',  color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'DEPOIST', label: 'Depoist', color: 'bg-orange-100 text-orange-800 border-orange-200' },
]

const CONTENT: Record<Role, Section[]> = {
  ADMIN: [
    {
      id: 'quickstart',
      title: 'Fillimi i Shpejtë — Admin',
      icon: <BookOpen className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shto produktet me foto, çmim dhe kategorinë e duhur." />
          <Step n={2} text="Shto klientët ose importo nga Excel tek Klientë → Importo." />
          <Step n={3} text="Krijo agjentët dhe cakto zonat dhe targetat e tyre." />
          <Step n={4} text="Monitoro sistemin çdo ditë nga paneli kryesor." />
          <Tip text="Paneli kryesor tregon alertet kritike — stok zero, borxhe të mëdha, kthime të papërpunuara." />
        </div>
      ),
    },
    {
      id: 'orders',
      title: 'Si funksionon cikli i porosisë',
      icon: <ShoppingCart className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Statuset e porosisë:</p>
          {[
            ['DRAFT', 'Agjenti ka filluar, por nuk e ka dërguar ende.'],
            ['SUBMITTED', 'Porosia u dërgua — pret aprovimin tuaj.'],
            ['APROVUAR', 'Ti e aprovove — depoisti e përgatit.'],
            ['NE_PERGATITJE', 'Depoisti po e përgatit.'],
            ['GATI_PER_NGARKIM', 'Gati — ngarkoni te shoferi.'],
            ['NE_DERGESE', 'Shoferi po e dërgon.'],
            ['DORËZUAR', 'U dorëzua te klienti.'],
            ['ANULUAR', 'U anulua.'],
          ].map(([s, d]) => (
            <div key={s} className="flex gap-2">
              <span className="font-mono text-xs font-bold text-primary shrink-0 w-36">{s}</span>
              <span className="text-xs">{d}</span>
            </div>
          ))}
          <Warn text="Porositë e Aprovuara që i kanë mbaruar produktet janë bllokuar automatikisht." />
        </div>
      ),
    },
    {
      id: 'stock',
      title: 'Si funksionon stoku',
      icon: <Package className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <p>Stoku llogaritet dinamikisht nga lëvizjet. Nuk ruhet si fushë e vetme.</p>
          <Step n={1} text="Shto stok fillestar kur krijon produktin." />
          <Step n={2} text="Çdo porosi e aprovuar rezervon stokun automatikisht." />
          <Step n={3} text="Çdo dorëzim i suksesshëm zbrit stokun definitivisht." />
          <Step n={4} text="Për korrigjime manuale: Produkte → [Produkti] → Ndrysho Stokun." />
          <Tip text="Gjithmonë shkruaj arsyen e korrigjimit. Çdo ndryshim regjistrohet në Audit Log." />
        </div>
      ),
    },
    {
      id: 'debt',
      title: 'Si funksionon borxhi i klientit',
      icon: <CreditCard className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <p>Borxhi = Totali i porosive të dorëzuara MINUS pagesat e regjistruara.</p>
          <Step n={1} text="Cakto Limit Borxhi për çdo klient tek Klientë → [Klienti] → Edito." />
          <Step n={2} text="Porosia e re kontrollon automatikisht nëse klienti i ka tejkaluar limitin." />
          <Step n={3} text="Regjistro pagesat tek Pagesa → Pagesë e Re." />
          <Warn text="Klientët me status BLLOKUAR nuk mund të bëjnë porosi të reja." />
        </div>
      ),
    },
    {
      id: 'reports',
      title: 'Raportet dhe Eksporti',
      icon: <BarChart2 className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shko tek Admin → Raporte." />
          <Step n={2} text="Zgjidhni llojin: Shitje, Pagesa, Borxhe, Vizita." />
          <Step n={3} text="Filtro sipas datave." />
          <Step n={4} text="Kliko 'Eksporto Excel' për të shkarkuar." />
          <Tip text="Raporti i Borxheve tregon bilancin aktual të çdo klienti me limitin dhe mbetjen." />
        </div>
      ),
    },
    {
      id: 'users',
      title: 'Menaxhimi i Përdoruesve',
      icon: <Users className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shko tek Admin → Përdoruesit → Përdorues i Ri." />
          <Step n={2} text="Cakto rolin: Admin, Agjent, Shofer, ose Depoist." />
          <Step n={3} text="Cakto lejet shtesë me butonin 'Lejet'." />
          <Step n={4} text="Çaktivizo llogarinë me butonin 'Çaktivizo'." />
          <Warn text="Admini ka të gjitha lejet automatikisht — nuk mund të kufizohet." />
        </div>
      ),
    },
    {
      id: 'config',
      title: 'Konfigurimi i Sistemit',
      icon: <Settings className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shko tek Admin → Konfigurim." />
          <p>Parametrat e disponueshëm:</p>
          <ul className="space-y-1 text-xs ml-2">
            <li><strong>Kufi Stoku të Ulët:</strong> produktet nën këtë sasi tregon alert.</li>
            <li><strong>Ditët Paralajmëruese Skadimi:</strong> sa ditë para skadimit tregon alert.</li>
            <li><strong>Kufi Borxhi për Aprovim:</strong> borxhi mbi këtë vlerë kërkon aprovim.</li>
            <li><strong>Emri/Adresa/Telefoni i Kompanisë:</strong> shfaqet në dokumentet e shtypura.</li>
            <li><strong>Shfaq Çmimin Publik:</strong> aktivizon çmimet në katalogun publik.</li>
          </ul>
        </div>
      ),
    },
  ],

  AGJENT: [
    {
      id: 'quickstart',
      title: 'Fillimi i Shpejtë — Agjent',
      icon: <BookOpen className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Hap Vizitën kur arrish te klienti (Vizita → Hap)." />
          <Step n={2} text="Krijo porosinë tek Porosi → Porosi e Re." />
          <Step n={3} text="Dorëzo porosinë dhe mbyll vizitën." />
          <Step n={4} text="Regjistro pagesën nëse klienti paguan cash." />
          <Tip text="Vizita e hapur e lidh porosinë automatikisht me klientin aktual." />
        </div>
      ),
    },
    {
      id: 'order',
      title: 'Si krijon porosinë',
      icon: <ShoppingCart className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shko tek Porosi → Porosi e Re." />
          <Step n={2} text="Zgjidh klientin nga lista." />
          <Step n={3} text="Kërko produktet me emrin ose kategorinë." />
          <Step n={4} text="Zgjidh sasinë dhe njësinë (Copë / Pako)." />
          <Step n={5} text="Shiko shportën dhe konfirmo." />
          <Step n={6} text="Klikoje 'Dërgoje Porosinë' kur je gati." />
          <Warn text="Porositë DRAFT ruhen por nuk i dërgoni admins deri sa t'i dërgoni." />
        </div>
      ),
    },
    {
      id: 'units',
      title: 'Copë vs Pako',
      icon: <Package className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <p><strong>Copë (COPE):</strong> njësia bazë — çmimi është për copë.</p>
          <p><strong>Pako (PAKO):</strong> grup copësh — çmimi llogaritet sipas numrit të copëve në pako.</p>
          <Step n={1} text="Zgjidh njësinë me butonat +/- nën produktin." />
          <Step n={2} text="Ndërrimi i njësisë llogarit automatikisht çmimin e ri." />
          <Tip text="Jo të gjithë produktet kanë pakon. Nëse Pako nuk shfaqet, produkti shitet vetëm copë." />
        </div>
      ),
    },
    {
      id: 'visits',
      title: 'Sistemi i Vizitave',
      icon: <MapPin className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shko tek Vizita → Vizitë e Re." />
          <Step n={2} text="Zgjidh klientin — sistemi regjistron GPS automatikisht." />
          <Step n={3} text="Krijo porosinë gjatë vizitës." />
          <Step n={4} text="Mbyll vizitën kur largohu — sistemi regjistron kohën." />
          <Warn text="Nëse nuk bëni porosi, shënoni arsyen pse nuk u bë (p.sh. stok i plotë, nuk ka nevojë)." />
        </div>
      ),
    },
    {
      id: 'debt',
      title: 'Borxhi i klientit',
      icon: <CreditCard className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <p>Tek secili klient mund të shohësh borxhin aktual.</p>
          <Warn text="Nëse klienti ka tejkaluar limitin e borxhit, porosia kërkon aprovim të veçantë nga Admini." />
          <Tip text="Regjistro pagesat cash menjëherë — kjo zbrit borxhin automatikisht." />
        </div>
      ),
    },
    {
      id: 'returns',
      title: 'Si bëhet kthimi',
      icon: <RotateCcw className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shko tek Kthime → Kthim i Ri." />
          <Step n={2} text="Zgjidh klientin dhe porosinë burimore." />
          <Step n={3} text="Shto produktet dhe sasinë që kthehet." />
          <Step n={4} text="Shënoji arsyen dhe dërgo." />
          <Tip text="Kthimet presin aprovim nga Admini para se të pranohen." />
        </div>
      ),
    },
  ],

  SHOFER: [
    {
      id: 'quickstart',
      title: 'Fillimi i Shpejtë — Shofer',
      icon: <BookOpen className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shko tek Dërgesa — shiko dorëzimet e ditës." />
          <Step n={2} text="Ngarko mallrat dhe ndrysho statusin në 'Ngarkuar'." />
          <Step n={3} text="Fillo rrugën — ndrysho statusin në 'Në Dërgim'." />
          <Step n={4} text="Pas çdo dorëzimi, shëno 'Dorëzuar' ose 'Dështuar'." />
          <Step n={5} text="Regjistro pagesat cash me butonin 'Regjistro Pagesë'." />
          <Tip text="Rruga/Itinerari tregon të gjitha adresat e ditës me Google Maps." />
        </div>
      ),
    },
    {
      id: 'delivery',
      title: 'Statuset e dorëzimit',
      icon: <Truck className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          {[
            ['ASSIGNED', 'Caktuar për ty — pret ngarkim.'],
            ['LOADED', 'Malli u ngarkua.'],
            ['IN_DELIVERY', 'Jeni duke e dorëzuar.'],
            ['DELIVERED', 'U dorëzua me sukses.'],
            ['FAILED', 'Dorëzimi dështoi — shëno arsyen.'],
          ].map(([s, d]) => (
            <div key={s} className="flex gap-2">
              <span className="font-mono text-xs font-bold text-primary shrink-0 w-28">{s}</span>
              <span className="text-xs">{d}</span>
            </div>
          ))}
          <Warn text="Nëse dorëzimi dështon, shëno gjithmonë arsyen — kjo ndikon në statistikat tuaja." />
        </div>
      ),
    },
    {
      id: 'payments',
      title: 'Pagesat Cash',
      icon: <CreditCard className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Pasi dorëzon, kliko 'Regjistro Pagesë' nëse klienti paguan cash." />
          <Step n={2} text="Fut shumën — mund të jetë edhe pjesore." />
          <Step n={3} text="Zgjidh metodën: Cash ose Bank." />
          <Tip text="Pagesat regjistrohen menjëherë dhe vlejnë për uljen e borxhit të klientit." />
        </div>
      ),
    },
    {
      id: 'returns',
      title: 'Kthimet gjatë dorëzimit',
      icon: <RotateCcw className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Nëse klienti kthen produkte, shko tek Kthime." />
          <Step n={2} text="Regjistro produktet e kthyera me arsyen." />
          <Step n={3} text="Kthimi do aprovohet nga depoisti kur ta dorëzoni mallin." />
          <Warn text="Mos i ngarko kthimet pa i regjistruar — depoisti duhet t'i presë." />
        </div>
      ),
    },
  ],

  DEPOIST: [
    {
      id: 'quickstart',
      title: 'Fillimi i Shpejtë — Depoist',
      icon: <BookOpen className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shiko porositë e Aprovuara — ato presin përgatitjen." />
          <Step n={2} text="Ndrysho statusin në 'Në Përgatitje' kur fillon." />
          <Step n={3} text="Ndrysho statusin në 'Gati për Ngarkim' kur përfundon." />
          <Step n={4} text="Monitoro stokun — regjistro dëmtimet menjëherë." />
          <Tip text="Shoferi do shohë porositë 'Gati për Ngarkim' automatikisht." />
        </div>
      ),
    },
    {
      id: 'orders',
      title: 'Përgatitja e porosive',
      icon: <ClipboardList className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shko tek Porositë — shiko ato me status APROVUAR." />
          <Step n={2} text="Hap porosinë — shiko listën e produkteve me sasitë." />
          <Step n={3} text="Mblidh mallrat sipas listës." />
          <Step n={4} text="Ndrysho statusin në 'Gati për Ngarkim'." />
          <Warn text="Nëse ndonjë produkt mungon, njoftoni Adminin para se të ndryshoni statusin." />
        </div>
      ),
    },
    {
      id: 'inventory',
      title: 'Inventari',
      icon: <Package className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shko tek Inventari → Inventar i Ri." />
          <Step n={2} text="Numëro produktet fizikisht." />
          <Step n={3} text="Fut numrin e llogaritur — sistemi tregon diferencën." />
          <Step n={4} text="Konfirmo inventarin — Admini e sheh rezultatin." />
          <Tip text="Bëj inventar të plotë periodikisht dhe inventar të shpejtë çdo ditë për produktet me lëvizje të madhe." />
        </div>
      ),
    },
    {
      id: 'returns',
      title: 'Kthimet',
      icon: <RotateCcw className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Kur shoferi sjell kthimin, shko tek Kthime." />
          <Step n={2} text="Zgjidh 'Marrë nga Shoferi' kur e pranon fizikisht." />
          <Step n={3} text="Kontrollo produktet — zgjidhë: kthe në stok ose shëno dëmtim." />
          <Warn text="Kthimet e dëmtuara duhet të regjistrohen tek Dëmtimet — NUK hyjnë në stok." />
        </div>
      ),
    },
    {
      id: 'damage',
      title: 'Regjistro Dëmtimet',
      icon: <AlertTriangle className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <Step n={1} text="Shko tek Dëmtimet → Dëmtim i Ri." />
          <Step n={2} text="Shto produktet e dëmtuara me sasinë dhe arsyen." />
          <Step n={3} text="Zgjidhë llojin: dëmtim në depo, transport, ose nga kthim." />
          <Tip text="Çdo dëmtim zbrit stokun automatikisht dhe regjistrohet me kohën dhe përdoruesin." />
        </div>
      ),
    },
  ],
}

export default function HelpPage() {
  const [activeRole, setActiveRole] = useState<Role>('ADMIN')

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Qendra e Ndihmës</h1>
          <p className="text-sm text-gray-500">Udhëzues sipas rolit</p>
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 flex-wrap">
        {ROLES.map(r => (
          <button
            key={r.id}
            onClick={() => setActiveRole(r.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              activeRole === r.id
                ? r.color
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {CONTENT[activeRole].map(section => (
          <Accordion key={section.id} title={section.title} icon={section.icon}>
            {section.content}
          </Accordion>
        ))}
      </div>

      {/* Footer note */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-500">TOSKA DISTRIBUTION — Sistemi i Menaxhimit të Shpërndarjes</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-gray-400 space-y-1">
          <p>Për probleme teknike ose pyetje, kontaktoni administratorin e sistemit.</p>
          <p>Çdo veprim kritik (ndryshim stoku, aprovim, pagesë) regjistrohet automatikisht në Audit Log.</p>
        </CardContent>
      </Card>
    </div>
  )
}
