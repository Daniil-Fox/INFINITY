import { Swiper } from "swiper";
import { Mousewheel } from "swiper/modules";
Swiper.use([Mousewheel]);
const sliders = document.querySelectorAll(".swiper");

if (sliders.length) {
  sliders.forEach((slider) => {
    new Swiper(slider, {
      slidesPerView: "auto",
      spaceBetween: 30,

      mousewheel: {
        releaseOnEdges: true,
      },
      grabCursor: true,
    });
  });
}
