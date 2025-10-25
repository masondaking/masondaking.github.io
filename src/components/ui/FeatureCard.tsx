import { ReactNode } from "react";
import { motion } from "framer-motion";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  delay?: number;
  children?: ReactNode;
}

export function FeatureCard({ icon, title, description, delay = 0, children }: FeatureCardProps) {
  return (
    <motion.div
      className="glass-card feature-card"
      style={{ backdropFilter: "blur(18px)" }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.02 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, delay }}
    >
      <div className="feature-card__icon" aria-hidden>
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </motion.div>
  );
}
