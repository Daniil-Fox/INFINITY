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

// (function initDifferentParallax() {
//   const section = document.querySelector('.different')
//   if (!section) return

//   const videoWrap = section.querySelector('.different__video')
//   if (!videoWrap) return

//   const shift = () => Math.round(Math.min(200, section.clientHeight * 0.2))

//   gsap.fromTo(
//     videoWrap,
//     { y: () => -shift() },
//     {
//       y: () => shift(),
//       ease: 'none',
//       scrollTrigger: {
//         trigger: section,
//         start: 'top bottom',
//         end: 'bottom top',
//         scrub: true,
//         invalidateOnRefresh: true
//       }
//     }
//   )
// })()
