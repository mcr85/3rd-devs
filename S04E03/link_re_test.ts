const s = `
# SoftoAI  Twój partner w nowoczesnym świecie

- [Start](/ "Strona główna")
- [Co oferujemy?](/uslugi "Zakres usług")
- [Portfolio](/portfolio "Opisy naszych ostatnich realizacji dla klientów")
- [Blog](/aktualnosci "Co wydarzyło się w naszej firmie?")
- [Kontakt](/kontakt "Zadzwoń do nas, wyślij maila lub odwiedź nas osobiście")
`

const baseUrl = 'https://softo.ag3nts.org/';

const re = /\\n-\[(\w+)\]/m
const matches = re.exec(s)
console.log(matches)