import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export function useSupabaseTable(table, { select = '*', orderBy = 'criado_em', ascending = false } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase.from(table).select(select)
    if (orderBy) query = query.order(orderBy, { ascending })
    const { data, error: err } = await query
    if (err) setError(err.message)
    setRows(data || [])
    setLoading(false)
  }, [table, select, orderBy, ascending])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const insert = async (values) => {
    const { data, error: err } = await supabase.from(table).insert(values).select(select)
    if (err) throw new Error(err.message)
    await fetchAll()
    return data
  }

  const update = async (id, values) => {
    const { data, error: err } = await supabase.from(table).update(values).eq('id', id).select(select)
    if (err) throw new Error(err.message)
    await fetchAll()
    return data
  }

  const remove = async (id) => {
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    if (err) throw new Error(err.message)
    await fetchAll()
  }

  return { rows, loading, error, refetch: fetchAll, insert, update, remove }
}
