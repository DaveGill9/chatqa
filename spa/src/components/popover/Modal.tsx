import { useEffect } from "react";
import Popover from "./PopoverPortal";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./Modal.module.scss";

interface ModalProps {
    children: React.ReactNode;
    className?: string;
    visible: boolean;
    onClose?: () => void;
}

export default function Modal({ children, className, visible, onClose }: ModalProps) {

    const modalClassName = `${styles.modal} ${className || ''}`.trim();

    useEffect(() => {
        if (!visible || !onClose) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [visible, onClose]);

    return (
        <AnimatePresence>
            {visible && (
                <Popover>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={styles.background}
                        onClick={() => onClose?.()}
                        role={onClose ? "button" : undefined}
                        aria-label={onClose ? "Close dialog" : undefined}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.7 }}
                            transition={{ duration: 0.2 }}
                            className={modalClassName}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {children}
                        </motion.div>
                    </motion.div>
                </Popover>
            )
            }
        </AnimatePresence >
    );
}