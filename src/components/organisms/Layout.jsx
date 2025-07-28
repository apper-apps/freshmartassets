import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/components/organisms/Header';
import Footer from '@/components/organisms/Footer';
import ChatWidget from '@/components/molecules/ChatWidget';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

return (
    <div className="min-h-screen bg-background touch-manipulation">
      <Header 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
      />
      
      <main className="flex-1 relative">
        <Outlet />
      </main>
      
      <Footer />
      <ChatWidget />
    </div>
  );
};
export default Layout;