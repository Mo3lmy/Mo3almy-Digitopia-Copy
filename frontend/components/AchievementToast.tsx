"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Star, Zap, Target, Flame, Brain, Medal, Award, CheckCircle } from 'lucide-react';
import { Achievement, achievementTracker } from '@/services/achievementTracker';
import confetti from 'canvas-confetti';

interface AchievementToastProps {
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
  autoHideDuration?: number;
}

const AchievementToast: React.FC<AchievementToastProps> = ({
  position = 'top-center',
  autoHideDuration = 5000,
}) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const unsubscribe = achievementTracker.subscribeToAchievements((newAchievements) => {
      setAchievements(prev => [...prev, ...newAchievements]);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.3 },
        colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1'],
      });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (achievements.length > 0 && currentIndex < achievements.length) {
      const timer = setTimeout(() => {
        if (currentIndex === achievements.length - 1) {
          setAchievements([]);
          setCurrentIndex(0);
        } else {
          setCurrentIndex(prev => prev + 1);
        }
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [achievements, currentIndex, autoHideDuration]);

  const handleClose = () => {
    setAchievements([]);
    setCurrentIndex(0);
  };

  const getIcon = (icon: string) => {
    const iconMap: Record<string, React.ReactElement> = {
      trophy: <Trophy className="w-8 h-8" />,
      star: <Star className="w-8 h-8" />,
      zap: <Zap className="w-8 h-8" />,
      target: <Target className="w-8 h-8" />,
      flame: <Flame className="w-8 h-8" />,
      brain: <Brain className="w-8 h-8" />,
      medal: <Medal className="w-8 h-8" />,
      award: <Award className="w-8 h-8" />,
      check: <CheckCircle className="w-8 h-8" />,
    };

    return iconMap[icon.toLowerCase()] || <Trophy className="w-8 h-8" />;
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 left-1/2 transform -translate-x-1/2';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'streak':
        return 'from-orange-500 to-red-500';
      case 'quiz':
        return 'from-blue-500 to-purple-500';
      case 'time':
        return 'from-green-500 to-teal-500';
      case 'mastery':
        return 'from-purple-500 to-pink-500';
      case 'level':
        return 'from-yellow-500 to-orange-500';
      default:
        return 'from-indigo-500 to-purple-500';
    }
  };

  const currentAchievement = achievements[currentIndex];

  return (
    <AnimatePresence>
      {currentAchievement && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 25,
          }}
          className={`fixed z-50 ${getPositionClasses()}`}
        >
          <div className="relative">
            <motion.div
              initial={{ rotate: -5 }}
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{
                duration: 0.5,
                repeat: 2,
                repeatType: 'reverse',
              }}
              className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-sm"
            >
              <div className={`h-2 bg-gradient-to-r ${getCategoryColor(currentAchievement.category)}`} />

              <div className="p-6">
                <button
                  onClick={handleClose}
                  className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{
                      duration: 0.5,
                      times: [0, 0.5, 1],
                    }}
                    className={`p-3 rounded-xl bg-gradient-to-br ${getCategoryColor(currentAchievement.category)} text-white shadow-lg`}
                  >
                    {getIcon(currentAchievement.icon)}
                  </motion.div>

                  <div className="flex-1">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {currentAchievement.titleAr || currentAchievement.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {currentAchievement.descriptionAr || currentAchievement.description}
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center gap-3"
                    >
                      <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-bold">+{currentAchievement.points}</span>
                      </div>

                      {currentAchievement.progress && currentAchievement.requirement && (
                        <div className="flex-1">
                          <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${Math.min((currentAchievement.progress / currentAchievement.requirement) * 100, 100)}%`
                              }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                              className="h-full bg-gradient-to-r from-green-400 to-green-600"
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>

                {achievements.length > 1 && (
                  <div className="flex justify-center gap-1 mt-4">
                    {achievements.map((_, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === currentIndex ? 'bg-gray-800' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-2xl opacity-20 blur-xl"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AchievementToast;