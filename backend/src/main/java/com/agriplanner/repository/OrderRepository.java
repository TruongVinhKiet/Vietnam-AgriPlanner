package com.agriplanner.repository;

import com.agriplanner.model.Order;
import com.agriplanner.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByUserOrderByCreatedAtDesc(User user);

    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<Order> findByOrderCode(String orderCode);

    Optional<Order> findByIdAndUserId(Long id, Long userId);

    List<Order> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, Order.OrderStatus status);

    List<Order> findByStatus(Order.OrderStatus status);

    @Query("SELECT o FROM Order o WHERE o.status = 'SHIPPING' AND o.trackingStartedAt IS NOT NULL")
    List<Order> findActiveShippingOrders();

    @Query("SELECT COUNT(o) FROM Order o WHERE o.user.id = :userId")
    long countByUserId(@Param("userId") Long userId);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.user.id = :userId AND o.status = :status")
    long countByUserIdAndStatus(@Param("userId") Long userId, @Param("status") Order.OrderStatus status);

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.items WHERE o.id = :id")
    Optional<Order> findByIdWithItems(@Param("id") Long id);

    @Query(value = "SELECT generate_order_code()", nativeQuery = true)
    String generateOrderCode();
}
