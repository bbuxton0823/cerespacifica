import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import db from '../config/database.js';

const connectedUsers = new Map();
const agencyRooms = new Map();

export function initSocketHandlers(io) {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user with agency info
      const user = await db('users')
        .select('users.*', 'agencies.name as agency_name')
        .leftJoin('agencies', 'users.agency_id', 'agencies.id')
        .where('users.id', decoded.userId)
        .where('users.is_active', true)
        .first();

      if (!user) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = user.id;
      socket.agencyId = user.agency_id;
      socket.userRole = user.role;
      socket.user = user;
      
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User ${socket.userId} connected from agency ${socket.agencyId}`);
    
    // Store connection
    connectedUsers.set(socket.userId, socket.id);
    
    // Join agency room for broadcasts
    const agencyRoom = `agency:${socket.agencyId}`;
    socket.join(agencyRoom);
    
    // Track agency room members
    if (!agencyRooms.has(socket.agencyId)) {
      agencyRooms.set(socket.agencyId, new Set());
    }
    agencyRooms.get(socket.agencyId).add(socket.userId);
    
    // Notify agency users of new connection
    socket.to(agencyRoom).emit('user:online', {
      userId: socket.userId,
      userName: `${socket.user.first_name} ${socket.user.last_name}`,
      role: socket.userRole
    });

    // Handle inspection updates
    socket.on('inspection:update', async (data) => {
      try {
        // Verify user has permission to update
        if (!['inspector', 'admin', 'manager'].includes(socket.userRole)) {
          return socket.emit('error', { message: 'Insufficient privileges' });
        }

        // Broadcast to agency members
        socket.to(agencyRoom).emit('inspection:updated', {
          inspectionId: data.inspectionId,
          updatedBy: socket.userId,
          timestamp: new Date().toISOString(),
          changes: data.changes
        });

        logger.info(`Inspection ${data.inspectionId} updated by ${socket.userId}`);
      } catch (error) {
        logger.error('Error handling inspection update:', error);
        socket.emit('error', { message: 'Failed to broadcast update' });
      }
    });

    // Handle sync status updates
    socket.on('sync:start', (data) => {
      socket.to(agencyRoom).emit('sync:status', {
        userId: socket.userId,
        deviceId: data.deviceId,
        status: 'syncing',
        timestamp: new Date().toISOString()
      });
    });

    socket.on('sync:complete', (data) => {
      socket.to(agencyRoom).emit('sync:status', {
        userId: socket.userId,
        deviceId: data.deviceId,
        status: 'completed',
        changes: data.changes,
        timestamp: new Date().toISOString()
      });
    });

    // Handle schedule updates
    socket.on('schedule:update', async (data) => {
      try {
        // Verify user has permission
        if (!['admin', 'manager'].includes(socket.userRole)) {
          return socket.emit('error', { message: 'Only admins can update schedules' });
        }

        // Notify affected inspector
        const inspectorSocketId = connectedUsers.get(data.inspectorId);
        if (inspectorSocketId) {
          io.to(inspectorSocketId).emit('schedule:changed', {
            scheduleId: data.scheduleId,
            changes: data.changes,
            updatedBy: socket.userId,
            timestamp: new Date().toISOString()
          });
        }

        // Broadcast to agency
        socket.to(agencyRoom).emit('schedule:updated', {
          scheduleId: data.scheduleId,
          inspectorId: data.inspectorId,
          updatedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error handling schedule update:', error);
        socket.emit('error', { message: 'Failed to update schedule' });
      }
    });

    // Handle 24-hour emergency notifications
    socket.on('emergency:24hour', async (data) => {
      try {
        // Log emergency
        logger.warn(`24-hour emergency reported by ${socket.userId}:`, data);

        // Notify all managers in agency
        const managers = await db('users')
          .where('agency_id', socket.agencyId)
          .where('role', 'manager')
          .where('is_active', true)
          .select('id');

        managers.forEach(manager => {
          const managerSocketId = connectedUsers.get(manager.id);
          if (managerSocketId) {
            io.to(managerSocketId).emit('emergency:alert', {
              inspectionId: data.inspectionId,
              unitAddress: data.unitAddress,
              issues: data.issues,
              reportedBy: socket.userId,
              timestamp: new Date().toISOString()
            });
          }
        });

        // Broadcast to agency
        socket.to(agencyRoom).emit('emergency:24hour', {
          inspectionId: data.inspectionId,
          unitAddress: data.unitAddress,
          reportedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error handling emergency notification:', error);
        socket.emit('error', { message: 'Failed to send emergency notification' });
      }
    });

    // Handle report generation status
    socket.on('report:generating', (data) => {
      socket.to(agencyRoom).emit('report:status', {
        reportId: data.reportId,
        status: 'generating',
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('report:ready', (data) => {
      socket.to(agencyRoom).emit('report:status', {
        reportId: data.reportId,
        status: 'ready',
        fileUrl: data.fileUrl,
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });
    });

    // Handle typing indicators for comments
    socket.on('typing:start', (data) => {
      socket.to(agencyRoom).emit('typing:status', {
        userId: socket.userId,
        userName: `${socket.user.first_name} ${socket.user.last_name}`,
        inspectionId: data.inspectionId,
        itemId: data.itemId,
        isTyping: true
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(agencyRoom).emit('typing:status', {
        userId: socket.userId,
        inspectionId: data.inspectionId,
        itemId: data.itemId,
        isTyping: false
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`User ${socket.userId} disconnected`);
      
      // Remove from connected users
      connectedUsers.delete(socket.userId);
      
      // Remove from agency room tracking
      if (agencyRooms.has(socket.agencyId)) {
        agencyRooms.get(socket.agencyId).delete(socket.userId);
        
        // Clean up empty rooms
        if (agencyRooms.get(socket.agencyId).size === 0) {
          agencyRooms.delete(socket.agencyId);
        }
      }
      
      // Notify agency users of disconnection
      socket.to(agencyRoom).emit('user:offline', {
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });
    });
  });
}

// Helper function to emit to specific agency
export function emitToAgency(agencyId, event, data) {
  const io = global.io;
  if (io) {
    io.to(`agency:${agencyId}`).emit(event, data);
  }
}

// Helper function to emit to specific user
export function emitToUser(userId, event, data) {
  const io = global.io;
  const socketId = connectedUsers.get(userId);
  if (io && socketId) {
    io.to(socketId).emit(event, data);
  }
}

// Get online users for an agency
export function getOnlineUsers(agencyId) {
  return Array.from(agencyRooms.get(agencyId) || []);
}

// Get connection status for a user
export function isUserOnline(userId) {
  return connectedUsers.has(userId);
}