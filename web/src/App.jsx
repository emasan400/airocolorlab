import { CartProvider, useCart } from './context/CartContext';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Marquee from './components/Marquee';
import ValueProps from './components/ValueProps';
import Lifestyle from './components/Lifestyle';
import Process from './components/Process';
import Catalog from './components/Catalog';
import Contact from './components/Contact';
import Faq from './components/Faq';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';

function Toast() {
  const { toast } = useCart();
  return <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>;
}

export default function App() {
  return (
    <CartProvider>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <ValueProps />
        <Lifestyle />
        <Process />
        <Catalog />
        <Contact />
        <Faq />
      </main>
      <Footer />
      <CartDrawer />
      <Toast />
    </CartProvider>
  );
}
