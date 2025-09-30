import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '@/stores/useAuthStore';
import { studentContextManager } from '@/services/studentContext';
import { achievementTracker } from '@/services/achievementTracker';
import confetti from 'canvas-confetti';

interface WebSocketOptions {
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface EventHandler {
  event: string;
  handler: (data: any) => void;
}

export function useWebSocket(
  lessonId?: string,
  options: WebSocketOptions = {}
) {
  const {
    autoConnect = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000
  } = options;

  const { user, token } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const eventHandlersRef = useRef<EventHandler[]>([]);

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect || !token) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
      auth: {
        token
      },
      reconnection: true,
      reconnectionAttempts,
      reconnectionDelay
    });

    // Connection events
    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempt(0);

      // Authenticate
      socketInstance.emit('authenticate', { token });

      // Join lesson if provided
      if (lessonId) {
        socketInstance.emit('join_lesson', { lessonId });
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionError(error.message);
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      setReconnectAttempt(attemptNumber);
    });

    // Store socket instance
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [token, lessonId, autoConnect, reconnectionAttempts, reconnectionDelay]);

  // Connect manually
  const connect = useCallback(() => {
    if (socket && !isConnected) {
      socket.connect();
    }
  }, [socket, isConnected]);

  // Disconnect manually
  const disconnect = useCallback(() => {
    if (socket && isConnected) {
      socket.disconnect();
    }
  }, [socket, isConnected]);

  // Emit event
  const emit = useCallback((event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot emit event:', event);
    }
  }, [socket, isConnected]);

  // Listen to events
  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (socket) {
      socket.on(event, handler);
      eventHandlersRef.current.push({ event, handler });
    }

    // Return cleanup function
    return () => {
      if (socket) {
        socket.off(event, handler);
        eventHandlersRef.current = eventHandlersRef.current.filter(
          eh => !(eh.event === event && eh.handler === handler)
        );
      }
    };
  }, [socket]);

  // Listen to event once
  const once = useCallback((event: string, handler: (data: any) => void) => {
    if (socket) {
      socket.once(event, handler);
    }
  }, [socket]);

  // Remove listener
  const off = useCallback((event: string, handler?: (data: any) => void) => {
    if (socket) {
      if (handler) {
        socket.off(event, handler);
      } else {
        socket.off(event);
      }
    }
  }, [socket]);

  // Cleanup all listeners
  const removeAllListeners = useCallback((event?: string) => {
    if (socket) {
      if (event) {
        socket.removeAllListeners(event);
      } else {
        socket.removeAllListeners();
      }
      eventHandlersRef.current = event
        ? eventHandlersRef.current.filter(eh => eh.event !== event)
        : [];
    }
  }, [socket]);

  // Join room
  const joinRoom = useCallback((room: string) => {
    emit('join_room', { room });
  }, [emit]);

  // Leave room
  const leaveRoom = useCallback((room: string) => {
    emit('leave_room', { room });
  }, [emit]);

  // Event handlers for specific features

  // Teaching Assistant events
  const onTeachingUpdate = useCallback((handler: (data: any) => void) => {
    return on('teaching_update', handler);
  }, [on]);

  const onTeachingInteraction = useCallback((handler: (data: any) => void) => {
    return on('teaching_interaction', handler);
  }, [on]);

  // Emotional Intelligence events
  const onEmotionalStateChange = useCallback((handler: (data: any) => void) => {
    return on('emotional_state_change', handler);
  }, [on]);

  const onSupportMessage = useCallback((handler: (data: any) => void) => {
    return on('support_message', handler);
  }, [on]);

  // Achievement events
  const onAchievementUnlocked = useCallback((handler: (data: any) => void) => {
    return on('achievement_unlocked', handler);
  }, [on]);

  const onProgressUpdate = useCallback((handler: (data: any) => void) => {
    return on('progress_update', handler);
  }, [on]);

  // Context and real-time update handlers
  useEffect(() => {
    if (!socket) return;

    // Real-time context updates
    const handleContextUpdate = (data: any) => {
      console.log('Context updated via WebSocket:', data);
      studentContextManager.updateContext('websocket_update', data);
    };

    // Achievement unlocked in real-time
    const handleAchievementUnlocked = (achievement: any) => {
      console.log('Achievement unlocked:', achievement);
      achievementTracker.subscribeToAchievements((achievements) => {
        // Achievements are already handled by the tracker
      });

      // Trigger celebration
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.3 },
        colors: ['#FFD700', '#FFA500', '#FF6B6B'],
      });

      // Update context with new achievement
      const context = studentContextManager.getContext();
      if (context) {
        const updatedContext = {
          ...context,
          achievements: [...(context.achievements || []), achievement.title],
          points: (context.points || 0) + (achievement.points || 0),
        };
        studentContextManager.updateContext('achievement_added', updatedContext);
      }
    };

    // Streak updates with milestones
    const handleStreakUpdate = (streak: any) => {
      console.log('Streak updated:', streak);
      const context = studentContextManager.getContext();
      if (context) {
        const updatedContext = {
          ...context,
          streakCount: streak.current,
          longestStreak: Math.max(streak.current, context.longestStreak || 0),
        };
        studentContextManager.updateContext('streak_update', updatedContext);

        // Celebrate milestone streaks
        if (streak.milestone) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FF6B6B', '#FFA500'],
          });
        }
      }
    };

    // Parent notification relay
    const handleParentNotification = (data: any) => {
      console.log('Parent notification sent:', data);
      // Parent notifications are handled server-side
      // This is just for logging/debugging
    };

    // Register all real-time handlers
    socket.on('context_updated', handleContextUpdate);
    socket.on('achievement_unlocked', handleAchievementUnlocked);
    socket.on('streak_updated', handleStreakUpdate);
    socket.on('parent_notification', handleParentNotification);

    return () => {
      socket.off('context_updated', handleContextUpdate);
      socket.off('achievement_unlocked', handleAchievementUnlocked);
      socket.off('streak_updated', handleStreakUpdate);
      socket.off('parent_notification', handleParentNotification);
    };
  }, [socket]);

  // Slide generation events
  const onSlideGenerationProgress = useCallback((handler: (data: any) => void) => {
    return on('slide_generation_progress', handler);
  }, [on]);

  const onSlideReady = useCallback((handler: (data: any) => void) => {
    return on('slide_ready', handler);
  }, [on]);

  // Quiz events
  const onQuizAnswer = useCallback((handler: (data: any) => void) => {
    return on('quiz_answer', handler);
  }, [on]);

  const onQuizComplete = useCallback((handler: (data: any) => void) => {
    return on('quiz_complete', handler);
  }, [on]);

  // Chat events
  const onChatMessage = useCallback((handler: (data: any) => void) => {
    return on('chat_message', handler);
  }, [on]);

  const sendChatMessage = useCallback((message: string, context?: any) => {
    emit('chat_message', {
      message,
      userId: user?.id,
      lessonId,
      context,
      timestamp: new Date()
    });
  }, [emit, user, lessonId]);

  // User activity tracking with real-time updates
  const trackUserActivity = useCallback((activity: string, metadata?: any) => {
    const payload = {
      activity,
      metadata,
      userId: user?.id,
      lessonId,
      timestamp: new Date()
    };

    emit('user_activity', payload);

    // Send specific event types for instant updates
    switch (activity) {
      case 'quiz_answer':
        emit('quiz_answer_submitted', {
          ...payload,
          isCorrect: metadata?.isCorrect,
          topic: metadata?.topic,
          questionId: metadata?.questionId,
        });
        break;
      case 'help_requested':
        emit('help_requested', {
          ...payload,
          helpType: metadata?.type,
          topic: metadata?.topic,
          reason: metadata?.reason,
        });
        break;
      case 'lesson_completed':
        emit('lesson_completed', {
          ...payload,
          lessonId: metadata?.lessonId,
          duration: metadata?.duration,
          score: metadata?.score,
        });
        break;
      case 'break_taken':
        emit('break_taken', {
          ...payload,
          breakDuration: metadata?.duration,
          reason: metadata?.reason,
        });
        break;
      case 'question_asked':
        emit('question_asked', {
          ...payload,
          question: metadata?.question,
          context: metadata?.context,
        });
        break;
    }
  }, [emit, user, lessonId]);

  // Send quiz answer for real-time updates
  const sendQuizAnswer = useCallback((questionId: string, answer: string, isCorrect: boolean, topic: string) => {
    trackUserActivity('quiz_answer', {
      questionId,
      answer,
      isCorrect,
      topic,
    });
  }, [trackUserActivity]);

  // Send help request for real-time updates
  const sendHelpRequest = useCallback((type: string, topic: string, reason?: string) => {
    trackUserActivity('help_requested', {
      type,
      topic,
      reason,
    });
  }, [trackUserActivity]);

  // Send lesson completion for real-time updates
  const sendLessonCompletion = useCallback((lessonId: string, duration: number, score?: number) => {
    trackUserActivity('lesson_completed', {
      lessonId,
      duration,
      score,
    });
  }, [trackUserActivity]);

  // Send break taken for real-time updates
  const sendBreakTaken = useCallback((duration: number, reason?: string) => {
    trackUserActivity('break_taken', {
      duration,
      reason,
    });
  }, [trackUserActivity]);

  // Send question asked for real-time updates
  const sendQuestionAsked = useCallback((question: string, context?: any) => {
    trackUserActivity('question_asked', {
      question,
      context,
    });
  }, [trackUserActivity]);

  // Update emotional state
  const updateEmotionalState = useCallback((state: any) => {
    emit('update_emotional_state', {
      ...state,
      userId: user?.id,
      timestamp: new Date()
    });
  }, [emit, user]);

  // Request teaching interaction
  const requestTeachingInteraction = useCallback((type: string, context?: any) => {
    emit('teaching_interaction_request', {
      type,
      context,
      userId: user?.id,
      lessonId,
      timestamp: new Date()
    });
  }, [emit, user, lessonId]);

  return {
    // Connection state
    socket,
    isConnected,
    connectionError,
    reconnectAttempt,

    // Connection methods
    connect,
    disconnect,

    // Core event methods
    emit,
    on,
    once,
    off,
    removeAllListeners,

    // Room methods
    joinRoom,
    leaveRoom,

    // Feature-specific methods
    onTeachingUpdate,
    onTeachingInteraction,
    onEmotionalStateChange,
    onSupportMessage,
    onAchievementUnlocked,
    onProgressUpdate,
    onSlideGenerationProgress,
    onSlideReady,
    onQuizAnswer,
    onQuizComplete,
    onChatMessage,
    sendChatMessage,
    trackUserActivity,
    updateEmotionalState,
    requestTeachingInteraction,

    // Real-time action methods
    sendQuizAnswer,
    sendHelpRequest,
    sendLessonCompletion,
    sendBreakTaken,
    sendQuestionAsked,
  };
}