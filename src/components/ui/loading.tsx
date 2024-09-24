import { motion } from "framer-motion";

export const Loading = () => {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      >
        <span>.</span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 0.2,
            duration: 0.5,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        >
          .
        </motion.span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 0.4,
            duration: 0.5,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        >
          .
        </motion.span>
      </motion.div>
    </div>
  );
};
