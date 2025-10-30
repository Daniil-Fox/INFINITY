import {gsap} from 'gsap'
import {ScrollTrigger} from 'gsap/ScrollTrigger.js'

gsap.registerPlugin(ScrollTrigger)

const horScrollWraps = document.querySelectorAll('.horScroll')

if (horScrollWraps.length > 0) {
  horScrollWraps.forEach((horScroll) => {
    const horScrollContainer = horScroll.querySelector('.horScroll-container')
    if (!horScrollContainer) return

    const getDistance = () => Math.max(0, horScrollContainer.scrollWidth - window.innerWidth)
    if (getDistance() === 0) return

    gsap.to(horScrollContainer, {
      x: () => -getDistance(),
      ease: 'none',
      scrollTrigger: {
        trigger: horScroll,
        start: 'top top',
        end: () => `+=${getDistance()}`,
        scrub: 1,
        pin: true,
        invalidateOnRefresh: true,
      }
    })
  })
}
