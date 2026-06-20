/**
 * Home.jsx - Landing Page
 *
 * The main landing page of the application, featuring the hero section,
 * property search, featured listings, and various promotional sections.
 */

import Hero from '../components/Hero'
import SmartSearch from '../components/SmartSearch'
import Rooms from '../components/Rooms'
import NearByRooms from '../components/NearByRooms'
import CitiesCards from '../components/CitiesCards'
import Faqs from '../components/Faqs'
import BecomeHost from '../components/BecomeHost'
import Testimonial from '../components/Testimonial'
import SubscribeLetter from '../components/SubscribeLetter'

// ==========================================
// Home Component
// ==========================================

/**
 * Home - Renders the landing page sections.
 * @returns {JSX.Element}
 */
const Home = () => {
    return (
        <>
            <Hero />
            <SmartSearch />
            <Rooms />
            <NearByRooms />
            <CitiesCards />
            <BecomeHost />
            <Testimonial />
            <Faqs />
            <SubscribeLetter />
        </>
    )
}

export default Home
