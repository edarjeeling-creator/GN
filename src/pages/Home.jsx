import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, Trophy, ChevronRight } from 'lucide-react';

const Home = () => {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 to-blue-900 text-white">
        
        {/* Animated Background Particles */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
           {/* We will add Three.js or complex framer-motion particles here in Phase 2. For now, simple CSS gradient and floating orbs */}
           <motion.div 
              animate={{ y: [0, -20, 0], opacity: [0.5, 0.8, 0.5] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute top-20 left-1/4 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl"
           />
           <motion.div 
              animate={{ y: [0, 30, 0], opacity: [0.5, 0.8, 0.5] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-20 right-1/4 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl"
           />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mt-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <img src="/logo.png" alt="Logo" className="w-32 h-32 mx-auto mb-8 drop-shadow-2xl" />
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              Welcome to the <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Future of Education
              </span>
            </h1>
            
            <p className="mt-4 text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto mb-10 font-light">
              A futuristic digital school campus — interactive, intelligent, secure, and visually unforgettable.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/admissions" className="px-8 py-4 rounded-full bg-white text-blue-900 font-bold text-lg hover:bg-blue-50 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center justify-center gap-2">
                Apply Now <ArrowRight size={20} />
              </Link>
              <Link to="/login" className="px-8 py-4 rounded-full bg-transparent border-2 border-white/30 text-white font-bold text-lg hover:bg-white/10 transition-colors backdrop-blur-sm flex items-center justify-center gap-2">
                Student & Parent Portal
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Info Bar (Ticker) */}
      <div className="bg-emerald-600 text-white py-3 overflow-hidden relative shadow-lg">
        <motion.div 
          animate={{ x: ["100%", "-100%"] }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          className="whitespace-nowrap font-medium text-sm md:text-base tracking-wide"
        >
          <span className="mx-4">🔔 ADMISSIONS OPEN FOR 2026-2027 ACADEMIC YEAR</span> • 
          <span className="mx-4">📅 MID-TERM EXAMS COMMENCE ON 15TH JUNE</span> • 
          <span className="mx-4">👥 PARENT-TEACHER MEETING SCHEDULED FOR FRIDAY</span>
        </motion.div>
      </div>

      {/* Bento Grid: Why Choose Us */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Discover the Difference</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">Experience a revolutionary approach to learning, tailored for the modern student.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div 
              whileHover={{ y: -10 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700"
            >
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/50 rounded-2xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400">
                <BookOpen size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-4 dark:text-white">Academic Excellence</h3>
              <p className="text-gray-600 dark:text-gray-400">Comprehensive curriculum designed to foster critical thinking and intellectual growth.</p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -10 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700 md:col-span-2 relative overflow-hidden"
            >
              <div className="absolute right-0 bottom-0 opacity-10 dark:opacity-5 transform translate-x-1/4 translate-y-1/4">
                 <Trophy size={200} />
              </div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 dark:text-emerald-400">
                  <Trophy size={28} />
                </div>
                <h3 className="text-2xl font-bold mb-4 dark:text-white">Global Exposure & Innovation</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md">Our state-of-the-art facilities and international partnerships prepare students for a rapidly evolving world.</p>
                <Link to="/about" className="inline-flex items-center gap-2 mt-6 font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                  Read more <ChevronRight size={16} />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
