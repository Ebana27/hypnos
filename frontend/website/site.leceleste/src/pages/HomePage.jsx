import Booking from '../components/Booking'
import Hero from '../components/Hero'
import Intro from '../components/Intro'
import LieuSection from '../components/LieuSection'
import Marquee from '../components/Marquee'
import RoomsSection from '../components/RoomsSection'

export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />
      <Intro />
      <RoomsSection />
      <LieuSection />
      <Booking />
    </>
  )
}