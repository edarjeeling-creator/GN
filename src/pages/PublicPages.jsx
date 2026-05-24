const PlaceholderPage = ({ title }) => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">{title}</h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
        This section of the dynamic school website is currently under construction as part of the digital transformation.
      </p>
    </div>
  );
};

export const About = () => <PlaceholderPage title="About Our School" />;
export const Academics = () => <PlaceholderPage title="Academics & Curriculum" />;
export const Admissions = () => <PlaceholderPage title="Admissions Portal" />;
export const Faculty = () => <PlaceholderPage title="Our Faculty" />;
export const Contact = () => <PlaceholderPage title="Contact Us" />;
